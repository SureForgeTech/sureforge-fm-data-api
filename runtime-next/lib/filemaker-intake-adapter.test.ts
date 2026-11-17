import { describe, expect, it, vi } from 'vitest';
import { submitFileMakerRegistration } from './filemaker-intake-adapter';

const environment = { FMWEB_BRIDGE_URL: 'http://127.0.0.1:43123/fm', FMWEB_BRIDGE_TOKEN: 'server-only-token' };
const values = { attendee: '  Invented Attendee  ', email: 'invented@example.invalid' };
const send = (fetchFn: typeof fetch, env = environment) => submitFileMakerRegistration('event-registration', 'submission-id', values, fetchFn, env);

describe('server-only FileMaker registration handoff', () => {
  it('sends only the form envelope through the private bridge, preserving values and using no redirects or retries', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ status: 'accepted', receipt: 'fm-123' }));
    expect(await send(fetchFn)).toEqual({ status: 'accepted', receipt: 'fm-123' });
    expect(fetchFn).toHaveBeenCalledOnce();
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:43123/fm/submitRegistration');
    expect(init).toMatchObject({ method: 'POST', cache: 'no-store', redirect: 'error', headers: { 'Origin': 'http://127.0.0.1:3000', 'X-FM-Bridge-Token': 'server-only-token' } });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init?.body))).toEqual({ intakeId: 'event-registration', submissionId: 'submission-id', values });
  });
  it.each(['', 'https://external.invalid/fm', 'http://127.0.0.1:43123/other', 'http://user:pass@127.0.0.1:43123/fm', 'http://127.0.0.1:43123/fm?redirect=other'])('refuses invalid bridge destinations without a request (%s)', async (base) => {
    const fetchFn = vi.fn<typeof fetch>();expect(await send(fetchFn, { ...environment, FMWEB_BRIDGE_URL: base })).toEqual({ status: 'rejected' });expect(fetchFn).not.toHaveBeenCalled();
  });
  it('refuses a missing bridge token without a request', async () => {
    const fetchFn = vi.fn<typeof fetch>();expect(await send(fetchFn, { ...environment, FMWEB_BRIDGE_TOKEN: '' })).toEqual({ status: 'rejected' });expect(fetchFn).not.toHaveBeenCalled();
  });
  it.each([400, 401, 403, 404, 413, 415, 429])('sanitizes definite pre-dispatch refusal %i', async (status) => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response('upstream-secret-canary', { status }));
    expect(await send(fetchFn)).toEqual({ status: 'rejected' });expect(fetchFn).toHaveBeenCalledOnce();
  });
  it.each(['pending', 'uncertain', 'rejected', 'capacity', 'conflict'])('passes a typed safe %s result without upstream details', async (status) => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ status, error: 'upstream-secret-canary' }));
    expect(await send(fetchFn)).toEqual({ status });
  });
  it('reports invalid input without reflecting upstream error strings', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ status: 'invalid', errors: [{ message: 'upstream-secret-canary' }] }));
    const result = await send(fetchFn);expect(result.status).toBe('invalid');expect(JSON.stringify(result)).not.toContain('canary');
  });
  it.each([
    () => Promise.reject(new Error('upstream-secret-canary')),
    () => Promise.resolve(new Response('upstream-secret-canary', { status: 500 })),
    () => Promise.resolve(new Response('{')),
    () => Promise.resolve(Response.json({ status: 'accepted', receipt: 'https://bad.invalid' })),
    () => Promise.resolve(Response.json({ status: 'accepted' })),
    () => Promise.resolve(Response.json({ status: 'unknown' })),
    () => Promise.resolve(Response.json(null)),
    () => Promise.resolve(new Response('x'.repeat(32769)))
  ])('keeps an unknown outcome uncertain with no automatic retry', async (result) => {
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(result);expect(await send(fetchFn)).toEqual({ status: 'uncertain' });expect(fetchFn).toHaveBeenCalledOnce();
  });
  it('cancels oversized streamed replies', async () => {
    let canceled = false;
    const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(20000)); }, cancel() { canceled = true; } });
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response(stream));
    expect(await send(fetchFn)).toEqual({ status: 'uncertain' });expect(canceled).toBe(true);
  });
});
