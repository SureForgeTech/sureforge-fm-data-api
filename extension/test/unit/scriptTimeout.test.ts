import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http';
import type { AddressInfo } from 'net';

import nock from 'nock';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { FMClient } from '../../src/services/fmClient';
import { SecretStore } from '../../src/services/secretStore';
import { retiredAgentGrace } from '../../src/services/tlsAgent';
import type { ConnectionProfile } from '../../src/types/fm';
import { InMemorySecretStorage } from './mocks';

/**
 * A script that runs longer than the shared request timeout needs a longer deadline of its own.
 * The deadline belongs to the run: it replaces the shared one for that request and nothing else.
 */

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never;
const ok = (response: Record<string, unknown>) => JSON.stringify({ response, messages: [{ code: '0', message: 'OK' }] });

describe('a script run may ask for its own deadline', () => {
  const servers: Server[] = [];

  // The suite's setup blocks real network calls; this test needs a real local server.
  beforeAll(() => nock.restore());
  afterAll(() => {
    nock.activate();
    nock.disableNetConnect();
  });

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
  });

  /** A server whose script answers after `delayMs`, and whose session answers at once. */
  async function serve(delayMs: number): Promise<string> {
    const server = createServer((request: IncomingMessage, response: ServerResponse) => {
      const url = new URL(request.url ?? '/', 'http://x');
      if (request.method === 'POST' && url.pathname.endsWith('/sessions')) {
        response.setHeader('Content-Type', 'application/json');
        response.end(ok({ token: 'tok' }));
        return;
      }
      setTimeout(() => {
        response.setHeader('Content-Type', 'application/json');
        response.end(ok({ scriptResult: 'done', scriptError: '0' }));
      }, delayMs);
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  async function client(url: string, timeoutMs: number) {
    const secrets = new SecretStore(new InMemorySecretStorage() as never);
    await secrets.setPassword('p1', 'pw');
    await secrets.setSessionToken('p1', 'tok');
    const profile: ConnectionProfile = { id: 'p1', name: 'T', authMode: 'direct', serverUrl: url, database: 'Sales Db', username: 'u' };
    return { fm: new FMClient(secrets, logger, timeoutMs), profile };
  }

  it('runs longer than the shared timeout when the run asks for a longer deadline', async () => {
    const url = await serve(400);
    // The shared timeout is far shorter than the script needs, so only the run's own deadline can
    // let it finish.
    const { fm, profile } = await client(url, 150);

    const result = await fm.runScript(profile, { layout: 'Contacts', scriptName: 'Slow' }, { timeoutMs: 5000 });

    expect(result.response).toEqual({ scriptResult: 'done', scriptError: '0' });
  });

  it('gives up when the run asks for a shorter deadline than the shared one', async () => {
    const url = await serve(400);
    const { fm, profile } = await client(url, 30_000);

    const failure = await fm
      .runScript(profile, { layout: 'Contacts', scriptName: 'Slow' }, { timeoutMs: 100 })
      .then(() => undefined, (error: unknown) => error as { kind?: string; message: string });

    expect(failure?.kind).toBe('timeout');
    expect(failure?.message).toContain('timed out');
  });

  it('keeps the warning that the change may have been applied', async () => {
    const url = await serve(400);
    const { fm, profile } = await client(url, 30_000);

    const failure = await fm
      .runScript(profile, { layout: 'Contacts', scriptName: 'Slow' }, { timeoutMs: 100 })
      .then(() => undefined, (error: unknown) => error as { kind?: string; message: string });

    expect(failure?.message).toContain('The change may have been applied.');
  });

  it('points at the run\'s own deadline, not at the shared setting, when the run asked for one', async () => {
    const url = await serve(400);
    const { fm, profile } = await client(url, 30_000);

    const failure = await fm
      .runScript(profile, { layout: 'Contacts', scriptName: 'Slow' }, { timeoutMs: 100 })
      .then(() => undefined, (error: unknown) => error as { message: string });

    expect(failure?.message).toContain("raise this request's timeout");
    expect(failure?.message).not.toContain('filemaker.requestTimeoutMs');
  });

  it('keeps a retired TLS agent alive for a run that may last longer', async () => {
    const url = await serve(10);
    const { fm, profile } = await client(url, 30_000);

    await fm.runScript(profile, { layout: 'Contacts', scriptName: 'Quick' }, { timeoutMs: 600_000 });

    // The retired agent has to outlive a run that may last ten minutes, or the run is cut off
    // when the agent is replaced.
    expect(retiredAgentGrace()).toBeGreaterThanOrEqual(600_000 + 10_000);
  });

  it('keeps the shared setting in the advice when the run did not ask for a deadline', async () => {
    const url = await serve(400);
    const { fm, profile } = await client(url, 100);

    const failure = await fm
      .runScript(profile, { layout: 'Contacts', scriptName: 'Slow' })
      .then(() => undefined, (error: unknown) => error as { message: string });

    expect(failure?.message).toContain('raise the setting filemaker.requestTimeoutMs');
  });
});
