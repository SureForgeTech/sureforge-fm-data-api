import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http';
import type { AddressInfo } from 'net';

import nock from 'nock';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { FMClient } from '../../src/services/fmClient';
import { SecretStore } from '../../src/services/secretStore';
import type { ConnectionProfile } from '../../src/types/fm';
import { InMemorySecretStorage } from './mocks';

/**
 * A sign-in in flight belongs to the connection, but its deadline belongs to the request that
 * started it. A request that asked for a longer deadline must not be ended by a sign-in running
 * under a shorter one: it signs in for itself instead.
 */

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never;

/** The body of a request, read to the end. */
async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
const ok = (response: Record<string, unknown>) => JSON.stringify({ response, messages: [{ code: '0', message: 'OK' }] });

describe("a request's deadline is not shortened by a sign-in in flight", () => {
  const servers: Server[] = [];

  beforeAll(() => nock.restore());
  afterAll(() => {
    nock.activate();
    nock.disableNetConnect();
  });

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
  });

  async function listen(handler: (request: IncomingMessage, response: ServerResponse) => void): Promise<string> {
    const server = createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  async function client(url: string, timeoutMs: number) {
    const secrets = new SecretStore(new InMemorySecretStorage() as never);
    await secrets.setPassword('p1', 'pw');
    const profile: ConnectionProfile = { id: 'p1', name: 'T', authMode: 'direct', serverUrl: url, database: 'Sales Db', username: 'u' };
    return { fm: new FMClient(secrets, logger, timeoutMs), profile, secrets };
  }

  it('signs in for itself when a sign-in with a shorter deadline is in flight', async () => {
    // The first request starts a sign-in under the shared timeout, and the server is slow to
    // answer it. The second request asks for a longer deadline and must not be ended at the
    // shared one: it signs in for itself, under its own deadline.
    let sessions = 0;
    const url = await listen((request, response) => {
      const path = new URL(request.url ?? '/', 'http://x').pathname;
      response.setHeader('Content-Type', 'application/json');
      if (path.endsWith('/sessions')) {
        sessions += 1;
        const attempt = sessions;
        // The first sign-in is slow enough to outlive the shared timeout; the second answers in
        // time for the longer deadline the second request asked for.
        setTimeout(() => response.end(ok({ token: `tok${attempt}` })), attempt === 1 ? 400 : 120);
        return;
      }
      response.end(ok({ scriptResult: 'done', scriptError: '0' }));
    });
    const { fm, profile } = await client(url, 150);

    // The first run asks for the shared timeout, so its sign-in runs under the shared deadline.
    const first = fm.runScript(profile, { layout: 'Contacts', scriptName: 'Quick' }).catch((error: unknown) => error as { message: string });
    // The second run asks for longer and starts while the first sign-in is still in flight.
    await new Promise((resolve) => setTimeout(resolve, 30));
    const second = await fm.runScript(profile, { layout: 'Contacts', scriptName: 'Quick' }, { timeoutMs: 5000 });

    expect(second.response).toEqual({ scriptResult: 'done', scriptError: '0' });
    // The slow first sign-in still fails at the shared timeout; that failure belongs to the first
    // request and must not have ended the second one.
    const firstFailure = await first;
    expect(String((firstFailure as { message?: string }).message ?? '')).toContain('timed out');
    expect(sessions).toBeGreaterThanOrEqual(2);
  });

  it('gives the proxy sign-in the deadline the caller asked for', async () => {
    // A proxy profile signs in through the proxy hop. The hop must carry the caller's deadline,
    // or a caller that asked for longer still has its sign-in ended at the shared timeout.
    const url = await listen(async (request, response) => {
      const body = JSON.parse((await readBody(request)) ?? '{}') as { action?: string };
      response.setHeader('Content-Type', 'application/json');
      if (body.action === 'createSession') {
        // The proxy hop is slow to answer the sign-in.
        setTimeout(() => response.end(JSON.stringify({ ok: true, data: { token: 'tok' } })), 400);
        return;
      }
      response.end(JSON.stringify({ ok: true, data: {} }));
    });
    const secrets = new SecretStore(new InMemorySecretStorage() as never);
    await secrets.setPassword('p1', 'pw');
    const profile: ConnectionProfile = {
      id: 'p1',
      name: 'T',
      authMode: 'proxy',
      serverUrl: url,
      proxyEndpoint: url,
      database: 'Sales Db',
      username: 'u'
    };
    const fm = new FMClient(secrets, logger, 150);

    const token = await fm.createSession(profile, { timeoutMs: 5000 });

    expect(token).toBe('tok');
  });

  it('does not let a settling sign-in delete the entry a newer sign-in registered', async () => {
    // The first request starts a sign-in under the shared deadline; the second asks for longer
    // and signs in for itself. When the first sign-in settles it must not clear the second one's
    // entry, or a third request would start a third sign-in instead of joining the second.
    let sessions = 0;
    const url = await listen((request, response) => {
      const path = new URL(request.url ?? '/', 'http://x').pathname;
      response.setHeader('Content-Type', 'application/json');
      if (path.endsWith('/sessions')) {
        sessions += 1;
        const attempt = sessions;
        // The first sign-in is slow enough to fail at the shared timeout; the second one stays in
        // flight long enough for the third request to arrive while it runs.
        setTimeout(() => response.end(ok({ token: `tok${attempt}` })), attempt === 1 ? 400 : 900);
        return;
      }
      response.end(ok({ scriptResult: 'done', scriptError: '0' }));
    });
    // The shared timeout is short, so the first sign-in runs under it and the second request,
    // which asks for longer, has to sign in for itself.
    const { fm, profile } = await client(url, 150);

    const first = fm.runScript(profile, { layout: 'Contacts', scriptName: 'Quick' }).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = fm.runScript(profile, { layout: 'Contacts', scriptName: 'Quick' }, { timeoutMs: 5000 });
    // The third request arrives after the first sign-in has settled and while the second one is
    // still in flight.
    await new Promise((resolve) => setTimeout(resolve, 250));
    const third = fm.runScript(profile, { layout: 'Contacts', scriptName: 'Quick' }, { timeoutMs: 5000 });

    await second;
    await third;
    await first;

    // The second and third requests share the second sign-in: three requests, two sign-ins.
    expect(sessions).toBe(2);
  });

  it('signs in for itself and leaves the connection on one token', async () => {
    let sessions = 0;
    // The two sign-ins can both succeed, so the server may hold a session this request's token
    // replaced. The connection ends on one token, and the replaced session is closed by the
    // refresh path that already retires the token it replaces.
    const deleted: string[] = [];
    const url = await listen((request, response) => {
      const path = new URL(request.url ?? '/', 'http://x').pathname;
      response.setHeader('Content-Type', 'application/json');
      if (path.endsWith('/sessions') && request.method === 'DELETE') {
        deleted.push(decodeURIComponent(path.split('/').pop() ?? ''));
        response.end(ok({}));
        return;
      }
      if (path.endsWith('/sessions')) {
        sessions += 1;
        const attempt = sessions;
        setTimeout(() => response.end(ok({ token: `tok${attempt}` })), attempt === 1 ? 120 : 40);
        return;
      }
      response.end(ok({ scriptResult: 'done', scriptError: '0' }));
    });
    const { fm, profile, secrets } = await client(url, 30_000);

    const first = fm.runScript(profile, { layout: 'Contacts', scriptName: 'Quick' }, { timeoutMs: 1000 });
    await new Promise((resolve) => setTimeout(resolve, 20));
    await fm.runScript(profile, { layout: 'Contacts', scriptName: 'Quick' }, { timeoutMs: 5000 });
    await first;
    await new Promise((resolve) => setTimeout(resolve, 100));

    // The connection is on one token, and both sign-ins really happened.
    const kept = await secrets.getSessionToken('p1');
    expect(['tok1', 'tok2']).toContain(kept);
    expect(sessions).toBe(2);
    // The sign-in that lost the race left a session on the server. This pull request does not
    // close it: the refresh path retires the token it replaces, and a token stored by a
    // parallel sign-in is not the token this refresh replaced. The server expires it on its own,
    // and that is the documented cost of not ending a run at a deadline the user never chose.
    expect(deleted).toEqual([]);
  });

  it('shares a sign-in in flight with an ordinary request that arrives partway through it', async () => {
    // Two requests on the shared timeout, the second arriving well into the first one's sign-in:
    // they must share it, or the connection is left with a second, orphaned session.
    let sessions = 0;
    const url = await listen((request, response) => {
      const path = new URL(request.url ?? '/', 'http://x').pathname;
      response.setHeader('Content-Type', 'application/json');
      if (path.endsWith('/sessions')) {
        sessions += 1;
        setTimeout(() => response.end(ok({ token: `tok${sessions}` })), 1500);
        return;
      }
      response.end(ok({ scriptResult: 'done', scriptError: '0' }));
    });
    const { fm, profile } = await client(url, 3000);

    const first = fm.runScript(profile, { layout: 'Contacts', scriptName: 'Quick' });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const second = await fm.runScript(profile, { layout: 'Contacts', scriptName: 'Quick' });

    expect((await first).response).toEqual({ scriptResult: 'done', scriptError: '0' });
    expect(second.response).toEqual({ scriptResult: 'done', scriptError: '0' });
    expect(sessions).toBe(1);
  });

  it('waits for a sign-in in flight that runs under a deadline at least as long as its own', async () => {
    // Both requests ask for the same longer deadline, so the second waits for the sign-in the
    // first started instead of signing in again: the connection gets one session, not two.
    let sessions = 0;
    const url = await listen((request, response) => {
      const path = new URL(request.url ?? '/', 'http://x').pathname;
      response.setHeader('Content-Type', 'application/json');
      if (path.endsWith('/sessions')) {
        sessions += 1;
        setTimeout(() => response.end(ok({ token: `tok${sessions}` })), 120);
        return;
      }
      response.end(ok({ scriptResult: 'done', scriptError: '0' }));
    });
    const { fm, profile } = await client(url, 150);

    const first = fm.runScript(profile, { layout: 'Contacts', scriptName: 'Quick' }, { timeoutMs: 5000 });
    await new Promise((resolve) => setTimeout(resolve, 30));
    const second = await fm.runScript(profile, { layout: 'Contacts', scriptName: 'Quick' }, { timeoutMs: 5000 });

    expect((await first).response).toEqual({ scriptResult: 'done', scriptError: '0' });
    expect(second.response).toEqual({ scriptResult: 'done', scriptError: '0' });
    expect(sessions).toBe(1);
  });
});
