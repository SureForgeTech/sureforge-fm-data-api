import { AxiosError, type AxiosProgressEvent, type AxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FMClientError } from '../../src/services/errors';
import type { ClientContext } from '../../src/services/fmClient/context';
import { runScript } from '../../src/services/fmClient/scripts';
import { waitForSession } from '../../src/services/fmClient/session';
import { requestWithAuth, requestWithAuthRaw } from '../../src/services/fmClient/transport';
import type { RequestOptions, RequestTrace } from '../../src/services/fmClient/types';
import { directProfile as profile } from './snippets/fixtures';

const ok = () => ({ status: 200, headers: {}, data: { response: { scriptError: '0', scriptResult: 'done' }, messages: [{ code: '0', message: 'OK' }] } });
const trace = (): RequestTrace => ({ operation: 'runScript', requestId: 'test', reauthCount: 0, cacheHit: false, endpoint: '' });
const script = { layout: 'Contacts', scriptName: 'Send Welcome' };
const request: RequestOptions = { method: 'GET', path: '/layouts/Contacts/script/Send%20Welcome', timeoutMs: 1000 };

function setup() {
  const http = vi.fn<(options: AxiosRequestConfig) => Promise<ReturnType<typeof ok>>>().mockResolvedValue(ok());
  const ensure = vi.fn(async () => 'token');
  const renew = vi.fn(async () => {});
  const client = {
    timeoutMs: 5000,
    httpClient: { request: http },
    ensureSessionToken: ensure,
    renewRejectedSession: renew,
    explainPinnedFailure: (_profile: unknown, error: FMClientError) => error,
    logger: { info: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
    withHistory: (_context: unknown, execute: (value: RequestTrace) => Promise<unknown>) => execute(trace()),
    dateFormats: () => 0,
    layoutMetadataCache: new Map(),
    getLayoutMetadata: vi.fn(async () => ({ fieldMetaData: [{ name: 'Name', result: 'text', type: 'normal' }] })),
    listRecords: vi.fn(async () => ({ data: [{ recordId: '1' }] }))
  } as unknown as ClientContext;
  client.requestWithAuth = (p, r, retry, t) => requestWithAuth(client, p, r, retry, t);
  return { client, http, ensure, renew };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(() => vi.useRealTimers());

describe.each([['envelope', requestWithAuth], ['raw', requestWithAuthRaw]] as const)('%s transport shares one deadline', (_name, send) => {
  it('subtracts a slow sign-in from the HTTP request budget', async () => {
    const { client, ensure, http } = setup();
    ensure.mockImplementationOnce(async () => { vi.setSystemTime(600); return 'token'; });
    await send(client, profile, request);
    expect(ensure).toHaveBeenCalledWith(profile, { timeoutMs: 1000, signal: undefined }, ...(_name === 'envelope' ? [undefined] : []));
    expect(http).toHaveBeenCalledWith(expect.objectContaining({ timeout: 400 }));
  });

  it('fails before dispatch when sign-in uses the entire budget, with own-deadline advice', async () => {
    const { client, ensure, http } = setup();
    ensure.mockImplementationOnce(async () => { vi.setSystemTime(1000); return 'token'; });
    await expect(send(client, profile, request)).rejects.toMatchObject({
      kind: 'timeout', message: expect.stringContaining("raise this request's timeout")
    });
    expect(http).not.toHaveBeenCalled();
  });

  it('retains the session-wait timeout code and advice', async () => {
    const { client, ensure, http } = setup();
    ensure.mockImplementationOnce(() => waitForSession(new Promise<string>(() => {}), undefined, 1000,
      "If the server is slow, raise this request's timeout."));
    const result = expect(send(client, profile, request)).rejects.toMatchObject({
      kind: 'timeout', code: 'SESSION_WAIT_TIMEOUT', message: expect.stringContaining("raise this request's timeout")
    });
    await vi.advanceTimersByTimeAsync(1000);
    await result;
    expect(http).not.toHaveBeenCalled();
  });

  it('does not dispatch if cancelled during sign-in', async () => {
    const { client, ensure, http } = setup();
    const controller = new AbortController();
    ensure.mockImplementationOnce(async () => { controller.abort(); return 'token'; });
    await expect(send(client, profile, { ...request, signal: controller.signal })).rejects.toMatchObject({ kind: 'cancellation' });
    expect(http).not.toHaveBeenCalled();
  });

  it('subtracts the first exchange and renewal from the retry budget', async () => {
    const { client, ensure, renew, http } = setup();
    ensure.mockImplementation(async () => { vi.setSystemTime(Date.now() + 100); return 'token'; });
    http.mockImplementationOnce(async () => {
      vi.setSystemTime(Date.now() + 200);
      throw new AxiosError('Rejected', undefined, undefined, undefined, { status: 401 } as never);
    });
    renew.mockImplementationOnce(async () => { vi.setSystemTime(Date.now() + 300); });
    await send(client, profile, request);
    expect(renew).toHaveBeenCalledWith(profile, 'token', { signal: undefined, timeoutMs: 700 });
    expect(ensure).toHaveBeenLastCalledWith(profile, { signal: undefined, timeoutMs: 400 }, ...(_name === 'envelope' ? [undefined] : []));
    expect(http.mock.calls.map((call) => call[0].timeout)).toEqual([900, 300]);
  });

  it('does not extend an own deadline when a fallback record read makes progress', async () => {
    const { client, http } = setup();
    http.mockImplementationOnce((options) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener?.('abort', () => reject(new AxiosError('Cancelled', 'ERR_CANCELED')));
    }));
    const result = expect(send(client, profile, { ...request, transfer: true })).rejects.toMatchObject({ kind: 'timeout' });
    await vi.advanceTimersByTimeAsync(600);
    http.mock.calls[0]![0].onDownloadProgress?.({ loaded: 65536 } as AxiosProgressEvent);
    await vi.advanceTimersByTimeAsync(400);
    await result;
  });

  it('does not retry when renewal exhausts the budget', async () => {
    const { client, renew, http } = setup();
    http.mockRejectedValueOnce(new AxiosError('Rejected', undefined, undefined, undefined, { status: 401 } as never));
    renew.mockImplementationOnce(async () => { vi.setSystemTime(1000); });
    await expect(send(client, profile, request)).rejects.toMatchObject({ kind: 'timeout' });
    expect(http).toHaveBeenCalledOnce();
  });

  it.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])('keeps shared timeouts with no usable deadline (%s)', async (timeoutMs) => {
    const { client, ensure, renew, http } = setup();
    ensure.mockImplementation(async () => { vi.setSystemTime(Date.now() + 6000); return 'token'; });
    http.mockRejectedValueOnce(new AxiosError('Rejected', undefined, undefined, undefined, { status: 401 } as never));
    renew.mockImplementationOnce(async () => { vi.setSystemTime(Date.now() + 6000); });
    await send(client, profile, { ...request, timeoutMs, transfer: true });
    expect(renew).toHaveBeenCalledWith(profile, 'token', { signal: undefined, timeoutMs });
    expect(http.mock.calls[0]![0].onDownloadProgress).toBeTypeOf('function');
    expect(http.mock.calls.map((call) => call[0].timeout)).toEqual([5000, 5000]);
  });
});

describe('script fallbacks spend the original run budget', () => {
  it('does not restart the deadline after an unsupported script endpoint', async () => {
    const { client, http } = setup();
    http.mockImplementationOnce(async () => {
      vi.setSystemTime(600);
      throw new AxiosError('Unsupported', undefined, undefined, undefined, { status: 405 } as never);
    });
    await runScript(client, profile, script, { timeoutMs: 1000 });
    expect(http.mock.calls.map((call) => call[0].timeout)).toEqual([1000, 400]);
  });

  it('does not dispatch the fallback after the budget is exhausted', async () => {
    const { client, http } = setup();
    http.mockImplementationOnce(async () => {
      vi.setSystemTime(1000);
      throw new AxiosError('Unsupported', undefined, undefined, undefined, { status: 405 } as never);
    });
    await expect(runScript(client, profile, script, { timeoutMs: 1000 })).rejects.toMatchObject({ kind: 'timeout' });
    expect(http).toHaveBeenCalledOnce();
  });

  it('subtracts the long-parameter metadata lookup before the find request', async () => {
    const { client, http } = setup();
    vi.mocked(client.getLayoutMetadata).mockImplementationOnce(async () => {
      vi.setSystemTime(600);
      return { fieldMetaData: [{ name: 'Name', result: 'text', type: 'normal' }] };
    });
    await runScript(client, profile, { ...script, scriptParam: 'x'.repeat(2500) }, { timeoutMs: 1000 });
    expect(client.getLayoutMetadata).toHaveBeenCalledWith(profile, script.layout, { signal: undefined, timeoutMs: 1000, recordHistory: false });
    expect(http).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', timeout: 400 }));
  });

  it('subtracts the empty-find check before falling back to a record request', async () => {
    const { client, http } = setup();
    http.mockImplementationOnce(async () => {
      vi.setSystemTime(300);
      throw new FMClientError('No records', { code: '401' });
    });
    vi.mocked(client.listRecords).mockImplementationOnce(async () => {
      vi.setSystemTime(700);
      return { data: [{ recordId: '1' }] } as never;
    });
    await expect(runScript(client, profile, { ...script, scriptParam: 'x'.repeat(2500) }, { timeoutMs: 1000 })).rejects.toMatchObject({ code: 'SCRIPT_PARAMETER_TOO_LONG' });
    expect(client.listRecords).toHaveBeenCalledWith(profile, script.layout, { limit: 1 }, { timeoutMs: 700 });
    expect(http).toHaveBeenCalledOnce();
  });
});
