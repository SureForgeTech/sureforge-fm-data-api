import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http';
import type { AddressInfo } from 'net';

import nock from 'nock';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { FMClient } from '../../src/services/fmClient';
import { SecretStore } from '../../src/services/secretStore';
import type { ConnectionProfile } from '../../src/types/fm';
import { InMemorySecretStorage } from './mocks';

/**
 * A sign-in in flight belongs to the connection, and a request that waits for it owns only its own
 * wait. A request that asked for a short deadline must not wait for a sign-in that runs under a
 * longer one: it would end at a deadline the user never chose.
 */

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never;
const ok = (response: Record<string, unknown>) =>
  JSON.stringify({ response, messages: [{ code: '0', message: 'OK' }] });

describe('a request waits for a session only as long as its own deadline allows', () => {
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
    const profile: ConnectionProfile = {
      id: 'p1',
      name: 'T',
      authMode: 'direct',
      serverUrl: url,
      database: 'Sales Db',
      username: 'u'
    };
    return { fm: new FMClient(secrets, logger, timeoutMs), profile };
  }

  it('ends a short-deadline request at its own deadline while it waits for a longer sign-in', async () => {
    // The first run starts a sign-in under a long deadline, and the server is slow to answer it.
    // The second run asks for a much shorter deadline, joins that sign-in, and must be ended by
    // its own deadline rather than wait for the sign-in to arrive.
    const url = await listen((request, response) => {
      const path = new URL(request.url ?? '/', 'http://x').pathname;
      response.setHeader('Content-Type', 'application/json');
      if (path.endsWith('/sessions')) {
        setTimeout(() => response.end(ok({ token: 'tok' })), 400);
        return;
      }
      response.end(ok({ scriptResult: 'done', scriptError: '0' }));
    });
    const { fm, profile } = await client(url, 30_000);

    const long = fm.runScript(profile, { layout: 'Contacts', scriptName: 'Quick' }, { timeoutMs: 5000 });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const startedAt = Date.now();
    const short = await fm
      .runScript(profile, { layout: 'Contacts', scriptName: 'Quick' }, { timeoutMs: 100 })
      .then(() => undefined, (error: unknown) => error as { kind?: string; message?: string });
    const waited = Date.now() - startedAt;

    // The short request is ended by its own deadline, well before the sign-in arrives.
    expect(short).toBeDefined();
    expect(short?.kind).toBe('timeout');
    expect(waited).toBeLessThan(350);
    // The long request still gets the token the sign-in produced.
    expect((await long).response).toEqual({ scriptResult: 'done', scriptError: '0' });
  });

  it('names the deadline of the request that gave up, not the shared setting', async () => {
    const url = await listen((request, response) => {
      const path = new URL(request.url ?? '/', 'http://x').pathname;
      response.setHeader('Content-Type', 'application/json');
      if (path.endsWith('/sessions')) {
        setTimeout(() => response.end(ok({ token: 'tok' })), 400);
        return;
      }
      response.end(ok({ scriptResult: 'done', scriptError: '0' }));
    });
    const { fm, profile } = await client(url, 30_000);

    const failure = await fm
      .runScript(profile, { layout: 'Contacts', scriptName: 'Quick' }, { timeoutMs: 100 })
      .then(() => undefined, (error: unknown) => error as { message?: string });

    expect(failure?.message).toBeDefined();
    expect(failure?.message).toContain('this request');
    expect(failure?.message).not.toContain('filemaker.requestTimeoutMs');
  });
});
