import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { previewIntakes } from './intake-registry';
import { eventRegistrationExample } from './registration-example';
import { POST } from '../app/api/intake/[id]/route';

const session = 's'.repeat(64);
const values = { name: 'Sample Attendee', email: 'sample@example.test', session: 'Morning' };
const context = (id = 'event-registration') => ({ params: Promise.resolve({ id }) });
function request(body: unknown = { submissionId: randomUUID(), values }, headers: Record<string, string> = {}) {
  return new NextRequest('http://127.0.0.1:3000/api/intake/event-registration', {
    method: 'POST', headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000',
      cookie: `fmweb_preview=${session}`, 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}
beforeEach(() => vi.stubEnv('FMWEB_PREVIEW_SESSION', session));
afterEach(() => vi.unstubAllEnvs());

describe('private sample intake endpoint', () => {
  it('validates the saved custom form rather than silently using the built-in definition', async () => {
    const example = eventRegistrationExample();
    example.definition.id = 'custom-event';
    example.definition.fields = [{ ...example.definition.fields[0], id: 'attendee', label: 'Attendee' }];
    const loaded = vi.spyOn(previewIntakes, 'load').mockResolvedValue(example);
    try {
      const accepted = await POST(request({ submissionId: randomUUID(), values: { attendee: 'Sample' } }), context('custom-event'));
      expect(accepted.status).toBe(201);
      const refused = await POST(request({ submissionId: randomUUID(), values }), context('custom-event'));
      expect(refused.status).toBe(422);
    } finally { loaded.mockRestore(); }
  });

  it.each([
    [{ cookie: '' }, 401], [{ host: 'evil.test' }, 403], [{ origin: 'https://evil.test' }, 403],
    [{ 'content-type': 'text/plain' }, 415]
  ])('refuses invalid private preview context before reading a submission', async (headers, status) => {
    expect((await POST(request(undefined, headers as Record<string, string>), context())).status).toBe(status);
  });
  it('rejects unknown targets, malformed JSON, unexpected envelope keys and malformed identifiers', async () => {
    expect((await POST(request(), context('../other'))).status).toBe(404);
    for (const body of ['{', null, [], { target: 'other', values }, { values }, { submissionId: 7, values }]) {
      expect((await POST(request(body), context())).status).toBe(400);
    }
    expect((await POST(request({ submissionId: 'invalid', values }), context())).status).toBe(422);
  });
  it('returns actionable field validation errors and never accepts tampered mappings', async () => {
    const invalid = await POST(request({ submissionId: randomUUID(), values: { ...values, email: 'invalid' } }), context());
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toMatchObject({ status: 'invalid', errors: [{ fieldId: 'email' }] });
    const tampered = await POST(request({ submissionId: randomUUID(), values: { ...values, 'Admin::Role': 'admin' } }), context());
    expect(tampered.status).toBe(422);
    expect(JSON.stringify(await tampered.json())).not.toContain('Admin::Role');
  });
  it('caps actual streamed bytes rather than trusting Content-Length', async () => {
    const large = await POST(request(' '.repeat(32769), { 'content-length': '2' }), context());
    expect(large.status).toBe(413);
    let cancelled = false;
    const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(20000)); },
      cancel() { cancelled = true; throw new Error('cancel failed'); } });
    const streamed = new NextRequest(request().url, { method: 'POST', headers: request().headers,
      body: stream, duplex: 'half' } as ConstructorParameters<typeof NextRequest>[1]);
    expect((await POST(streamed, context())).status).toBe(413);
    expect(cancelled).toBe(true);
  });
  it('rejects invalid UTF-8 and a body stream that fails', async () => {
    for (const stream of [
      new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([0xff])); controller.close(); } }),
      new ReadableStream({ start(controller) { controller.error(new Error('synthetic body failure')); } })
    ]) {
      const req = new NextRequest(request().url, { method: 'POST', headers: request().headers, body: stream, duplex: 'half' } as ConstructorParameters<typeof NextRequest>[1]);
      const response = await POST(req, context());expect(response.status).toBe(400);
      expect(JSON.stringify(await response.json())).not.toContain('synthetic');
    }
  });
  it('accepts a valid registration once and reuses the same receipt, without exposing values', async () => {
    const body = { submissionId: randomUUID(), values };
    const first = await POST(request(body), context());expect(first.status).toBe(201);
    expect(first.headers.get('cache-control')).toBe('no-store');
    const receipt = await first.json();expect(receipt).toMatchObject({ status: 'accepted', receipt: expect.stringMatching(/^sample-/) });
    expect(JSON.stringify(receipt)).not.toContain('sample@example.test');
    expect(await (await POST(request(body), context())).json()).toEqual(receipt);
    const conflict = await POST(request({ ...body, values: { ...values, name: 'Changed' } }), context());
    expect(conflict.status).toBe(409);expect(await conflict.json()).toEqual({ status: 'conflict' });
  });
});
