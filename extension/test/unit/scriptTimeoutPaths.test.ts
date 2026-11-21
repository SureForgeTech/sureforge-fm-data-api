import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'http';
import type { AddressInfo } from 'net';

import nock from 'nock';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { FMClient } from '../../src/services/fmClient';
import { ProxyClient } from '../../src/services/proxyClient';
import { retiredAgentGrace } from '../../src/services/tlsAgent';
import { SecretStore } from '../../src/services/secretStore';
import type { ConnectionProfile } from '../../src/types/fm';
import { InMemorySecretStorage } from './mocks';

/**
 * A run's own deadline has to reach every request the run makes, including the ones the runner
 * builds itself, and the advice after a timeout has to name the deadline that was in force.
 */

const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never;
const ok = (response: Record<string, unknown>) => JSON.stringify({ response, messages: [{ code: '0', message: 'OK' }] });

describe('a run\'s deadline reaches every request the run makes', () => {
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

  async function client(url: string, timeoutMs: number, profile: Partial<ConnectionProfile> = {}) {
    const secrets = new SecretStore(new InMemorySecretStorage() as never);
    await secrets.setPassword('p1', 'pw');
    await secrets.setSessionToken('p1', 'tok');
    const base: ConnectionProfile = { id: 'p1', name: 'T', authMode: 'direct', serverUrl: url, database: 'Sales Db', username: 'u' };
    return { fm: new FMClient(secrets, logger, timeoutMs), profile: { ...base, ...profile } as ConnectionProfile };
  }

  it('carries the deadline into the find the runner builds for a long parameter', async () => {
    // The parameter does not fit the 2,000-character address, so the runner sends a find with the
    // script attached. That find is the request that carries the deadline.
    const seen: string[] = [];
    const url = await listen((request, response) => {
      const path = new URL(request.url ?? '/', 'http://x').pathname;
      seen.push(`${request.method} ${path}`);
      response.setHeader('Content-Type', 'application/json');
      if (path.endsWith('/layouts/Contacts')) {
        // The metadata read a run needs is slow too, so it only passes with the run's deadline.
        setTimeout(() => response.end(ok({
          fieldMetaData: [{ name: 'Notes', result: 'text', type: 'normal', global: false }]
        })), 400);
        return;
      }
      if (path.endsWith('/records')) {
        // The runner checks that the layout has records before it sends the find.
        response.end(ok({ data: [{ fieldData: { Notes: 'a note' } }] }));
        return;
      }
      setTimeout(() => response.end(ok({ scriptResult: 'done', scriptError: '0' })), 400);
    });
    const { fm, profile } = await client(url, 150);

    const result = await fm.runScript(
      profile,
      { layout: 'Contacts', scriptName: 'Slow', scriptParam: 'x'.repeat(2500) },
      { timeoutMs: 5000 }
    );

    expect(result.response).toEqual({ scriptResult: 'done', scriptError: '0' });
    expect(seen.some((entry) => entry.endsWith('/_find'))).toBe(true);
  });

  it('gives the sign-in a run needs the run\'s deadline', async () => {
    // No stored token: the run has to sign in first, and the sign-in must not stop at the shared
    // timeout when the run asked for longer.
    const url = await listen((request, response) => {
      const path = new URL(request.url ?? '/', 'http://x').pathname;
      response.setHeader('Content-Type', 'application/json');
      if (path.endsWith('/sessions')) {
        setTimeout(() => response.end(ok({ token: 'tok' })), 400);
        return;
      }
      response.end(ok({ scriptResult: 'done', scriptError: '0' }));
    });
    const secrets = new SecretStore(new InMemorySecretStorage() as never);
    await secrets.setPassword('p1', 'pw');
    const profile: ConnectionProfile = { id: 'p1', name: 'T', authMode: 'direct', serverUrl: url, database: 'Sales Db', username: 'u' };
    const fm = new FMClient(secrets, logger, 150);

    const result = await fm.runScript(profile, { layout: 'Contacts', scriptName: 'Quick' }, { timeoutMs: 5000 });

    expect(result.response).toEqual({ scriptResult: 'done', scriptError: '0' });
  });

  it('gives the renewal after a rejected token the run\'s deadline', async () => {
    // The server rejects the token, so the run renews the session first. The renewal signs in
    // again, and that sign-in must not stop at the shared timeout.
    let sessions = 0;
    const url = await listen((request, response) => {
      const path = new URL(request.url ?? '/', 'http://x').pathname;
      response.setHeader('Content-Type', 'application/json');
      if (path.endsWith('/sessions')) {
        sessions += 1;
        setTimeout(() => response.end(ok({ token: `tok${sessions}` })), 400);
        return;
      }
      if (sessions === 0) {
        response.statusCode = 401;
        response.end(JSON.stringify({ response: {}, messages: [{ code: '952', message: 'invalid' }] }));
        return;
      }
      response.end(ok({ scriptResult: 'done', scriptError: '0' }));
    });
    const secrets = new SecretStore(new InMemorySecretStorage() as never);
    await secrets.setPassword('p1', 'pw');
    await secrets.setSessionToken('p1', 'stale');
    const profile: ConnectionProfile = { id: 'p1', name: 'T', authMode: 'direct', serverUrl: url, database: 'Sales Db', username: 'u' };
    const fm = new FMClient(secrets, logger, 150);

    const result = await fm.runScript(profile, { layout: 'Contacts', scriptName: 'Quick' }, { timeoutMs: 5000 });

    expect(result.response).toEqual({ scriptResult: 'done', scriptError: '0' });
    expect(sessions).toBeGreaterThan(0);
  });

  it('gives the read that checks the layout is not empty the run\'s deadline', async () => {
    // The layout has no usable text field, so the runner reads the records to see whether the
    // layout is empty. That read must not stop at the shared timeout when the run asked for longer.
    const url = await listen((request, response) => {
      const path = new URL(request.url ?? '/', 'http://x').pathname;
      response.setHeader('Content-Type', 'application/json');
      if (path.endsWith('/layouts/Contacts')) {
        response.end(ok({ fieldMetaData: [{ name: 'Total', result: 'number', type: 'normal', global: false }] }));
        return;
      }
      if (path.endsWith('/records')) {
        setTimeout(() => response.end(ok({ data: [{ fieldData: { Total: 1 } }] })), 400);
        return;
      }
      response.end(ok({ scriptResult: 'done', scriptError: '0' }));
    });
    const { fm, profile } = await client(url, 150);

    // The parameter is too long for the address, so the runner cannot send it that way; the read
    // it makes first must still have used the run's deadline, which is what this error shows.
    const failure = await fm
      .runScript(profile, { layout: 'Contacts', scriptName: 'Slow', scriptParam: 'x'.repeat(2500) }, { timeoutMs: 5000 })
      .then(() => undefined, (error: unknown) => error as { message: string });

    expect(failure?.message).toContain('too long');
  });

  it('gives a record write the deadline the control carries', async () => {
    const url = await listen((_request, response) => {
      response.setHeader('Content-Type', 'application/json');
      setTimeout(() => response.end(ok({ recordId: '1' })), 400);
    });
    const { fm, profile } = await client(url, 150);

    const written = await fm.createRecord(profile, 'Contacts', { Name: 'Ada' }, { timeoutMs: 5000 });

    expect(written.response).toMatchObject({ recordId: '1' });
  });

  it('falls back to the shared timeout when the proxy hop was given no usable deadline', async () => {
    const url = await listen((_request, response) => {
      setTimeout(() => response.end(JSON.stringify({ ok: true, data: { result: { response: {}, messages: [] } } })), 400);
    });
    const secrets = new SecretStore(new InMemorySecretStorage() as never);
    const proxy = new ProxyClient(secrets, logger, 30_000);
    const profile: ConnectionProfile = { id: 'p1', name: 'T', authMode: 'proxy', serverUrl: url, proxyEndpoint: url, database: 'Sales Db', username: 'u' };

    // A deadline of zero is not a deadline: the hop waits for the shared timeout instead of
    // ending at once.
    const result = await proxy.runScript(profile, { layout: 'Contacts', scriptName: 'Quick' }, undefined, 0);

    expect(result.response).toEqual({});
  });

  it('keeps the retired TLS agent alive for a proxy hop that may last longer', async () => {
    const url = await listen((_request, response) => {
      setTimeout(() => response.end(JSON.stringify({ ok: true, data: { result: { response: {}, messages: [] } } })), 10);
    });
    const secrets = new SecretStore(new InMemorySecretStorage() as never);
    const proxy = new ProxyClient(secrets, logger, 30_000);
    const profile: ConnectionProfile = { id: 'p1', name: 'T', authMode: 'proxy', serverUrl: url, proxyEndpoint: url, database: 'Sales Db', username: 'u' };

    await proxy.runScript(profile, { layout: 'Contacts', scriptName: 'Quick' }, undefined, 600_000);

    expect(retiredAgentGrace()).toBeGreaterThanOrEqual(610_000);
  });

  it('tells the user to raise the run\'s own deadline when the proxy hop times out', async () => {
    const url = await listen((_request, response) => {
      setTimeout(() => response.end('{}'), 400);
    });
    const secrets = new SecretStore(new InMemorySecretStorage() as never);
    const proxy = new ProxyClient(secrets, logger, 30_000);
    const profile: ConnectionProfile = { id: 'p1', name: 'T', authMode: 'proxy', serverUrl: url, proxyEndpoint: url, database: 'Sales Db', username: 'u' };

    const failure = await proxy
      .runScript(profile, { layout: 'Contacts', scriptName: 'Slow' }, undefined, 100)
      .then(() => undefined, (error: unknown) => error as { message: string });

    expect(failure?.message).toContain("raise this request's timeout");
    expect(failure?.message).not.toContain('filemaker.requestTimeoutMs');
  });
});
