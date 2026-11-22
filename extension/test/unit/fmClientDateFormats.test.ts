import path from 'path';

import { describe, expect, it, vi } from 'vitest';

import { FMClient } from '../../src/services/fmClient';
import { SecretStore } from '../../src/services/secretStore';
import { SettingsService } from '../../src/services/settingsService';
import type { ConnectionProfile } from '../../src/types/fm';
import { createAxiosResponse, InMemorySecretStorage } from './mocks';

class FakeAxios {
  public readonly request = vi.fn();
}

function createProfile(): ConnectionProfile {
  return {
    id: 'profile-1',
    name: 'Dev',
    authMode: 'direct',
    serverUrl: 'https://fm.example.com',
    database: 'TestDB',
    username: 'admin',
    apiBasePath: '/fmi/data',
    apiVersionPath: 'vLatest'
  };
}

async function clientWith(dateFormats: () => number): Promise<{ client: FMClient; http: FakeAxios; profile: ConnectionProfile; secrets: SecretStore }> {
  const secrets = new SecretStore(new InMemorySecretStorage() as never);
  const profile = createProfile();
  await secrets.setSessionToken(profile.id, 'token');
  const http = new FakeAxios();
  http.request.mockResolvedValue(
    createAxiosResponse({
      data: {
        response: { recordId: '1', modId: '1', data: [{ recordId: '1', fieldData: {} }], records: [] },
        messages: [{ code: '0', message: 'OK' }]
      }
    })
  );
  const client = new FMClient(
    secrets,
    { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    1500,
    http as never,
    undefined,
    undefined,
    undefined,
    undefined,
    dateFormats
  );
  return { client, http, profile, secrets };
}

describe('the date formats the developer chose', () => {
  it('sends the option on a find, a list and a record', async () => {
    const { client, http, profile } = await clientWith(() => 2);

    await client.findRecords(profile, 'Contacts', { query: [{ 'Name': 'Ada' }] });
    await client.listRecords(profile, 'Contacts');
    await client.getRecord(profile, 'Contacts', '1');

    expect(http.request.mock.calls[0]![0].data).toMatchObject({ dateformats: 2 });
    expect(http.request.mock.calls[1]![0].params).toMatchObject({ dateformats: 2 });
    expect(http.request.mock.calls[2]![0].params).toMatchObject({ dateformats: 2 });
  });

  it('sends the option on a create and an edit, so a value read is written back the same way', async () => {
    const { client, http, profile } = await clientWith(() => 2);

    await client.createRecord(profile, 'Contacts', { Name: 'Ada' });
    await client.editRecord(profile, 'Contacts', '1', { Name: 'Ada' });

    expect(http.request.mock.calls[0]![0].data).toMatchObject({ dateformats: 2 });
    expect(http.request.mock.calls[1]![0].data).toMatchObject({ dateformats: 2 });
  });

  it('sends nothing on a create or an edit when the developer leaves the server its own default', async () => {
    const { client, http, profile } = await clientWith(() => 0);

    await client.createRecord(profile, 'Contacts', { Name: 'Ada' });
    await client.editRecord(profile, 'Contacts', '1', { Name: 'Ada' });

    expect(http.request.mock.calls[0]![0].data).not.toHaveProperty('dateformats');
    expect(http.request.mock.calls[1]![0].data).not.toHaveProperty('dateformats');
  });

  it('sends nothing when the developer leaves the server its own default', async () => {
    const { client, http, profile } = await clientWith(() => 0);

    await client.findRecords(profile, 'Contacts', { query: [{ 'Name': 'Ada' }] });
    await client.listRecords(profile, 'Contacts');
    await client.getRecord(profile, 'Contacts', '1');

    expect(http.request.mock.calls[0]![0].data).not.toHaveProperty('dateformats');
    expect(http.request.mock.calls[1]![0].params ?? {}).not.toHaveProperty('dateformats');
    expect(http.request.mock.calls[2]![0].params ?? {}).not.toHaveProperty('dateformats');
  });

  it('writes a date back the way the server read it', async () => {
    // The mock engine keeps dates in the US order and converts them with the option, so a value
    // read in one format and written back in another would come out as a different day.
    const module = await import(path.resolve(__dirname, '../mock-server/lib/engine.mjs'));
    const engine = module.createEngine();
    const { client, http, profile, secrets } = await clientWith(() => 2);
    // The mock issues a session for the fixture account; the client signs in with it.
    await secrets.setPassword(profile.id, 'testpass1');
    await secrets.deleteSessionToken(profile.id);
    http.request.mockImplementation(async (config) => {
      const url = new URL(config.url);
      const reply = await engine.dispatch({
        method: config.method,
        pathname: url.pathname,
        query: new URLSearchParams(config.params),
        headers: { host: 'localhost', 'content-type': 'application/json', authorization: config.headers.Authorization },
        body: Buffer.from(JSON.stringify(config.data ?? {}))
      });
      return { ...createAxiosResponse({ data: reply.json }), status: reply.status };
    });

    const sales = { ...profile, database: 'Sales', username: 'tester' };
    const found = await client.findRecords(sales, 'Contacts', { query: [{ 'LastName': '*' }], limit: 1 });
    const record = found.data[0]!;
    const before = record.fieldData['Created'];
    expect(String(before)).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await client.editRecord(sales, 'Contacts', record.recordId, { 'Created': before });

    // Read it back through the API: the same day, in the same format.
    const reread = await client.findRecords(sales, 'Contacts', { query: [{ 'LastName': '*' }], limit: 1 });
    expect(reread.data[0]!.fieldData['Created']).toBe(before);
  });

  it('sends the option on the read that runs a script with a record in context', async () => {
    const { client, http, profile } = await clientWith(() => 2);
    http.request.mockResolvedValueOnce(
      createAxiosResponse({
        data: { response: { data: [{ recordId: '1', fieldData: {} }], scriptError: '0' }, messages: [{ code: '0', message: 'OK' }] }
      })
    );

    await client.runScript(profile, { layout: ' Contacts ', scriptName: ' Echo ', scriptParam: 'x y', recordId: '1' });

    expect(http.request.mock.calls.at(-1)![0].params).toMatchObject({ dateformats: 2 });
  });

  it('sends the option on the fallback read that runs a script', async () => {
    const { client, http, profile } = await clientWith(() => 2);
    // The script endpoint is refused, so the client falls back to reading a record with the script
    // attached, and that read has to agree with every other read.
    http.request
      .mockRejectedValueOnce({ isAxiosError: true, response: { status: 405 } })
      .mockResolvedValueOnce(
        createAxiosResponse({
          data: { response: { data: [{ recordId: '1', fieldData: {} }], scriptError: '0' }, messages: [{ code: '0', message: 'OK' }] }
        })
      );

    await client.runScript(profile, { layout: ' Contacts ', scriptName: ' Echo ', scriptParam: 'x y' });

    expect(http.request.mock.calls.at(-1)![0].method).toBe('GET');
    expect(http.request.mock.calls.at(-1)![0].params).toMatchObject({ dateformats: 2 });
  });

  it('leaves the proxy to decide, because the proxy is what talks to FileMaker', async () => {
    const secrets = new SecretStore(new InMemorySecretStorage() as never);
    const profile = { ...createProfile(), authMode: 'proxy' as const, proxyEndpoint: 'https://proxy.example/api' };
    const http = new FakeAxios();
    const proxy = {
      findRecords: vi.fn(async () => ({ result: { records: [], dataInfo: { foundCount: 0, returnedCount: 0, totalRecordCount: 0 } } })),
      getRecord: vi.fn(async () => ({ record: { recordId: '1', fieldData: {} } })),
      createRecord: vi.fn(async () => ({ recordId: '1', modId: '1' })),
      editRecord: vi.fn(async () => ({ recordId: '1', modId: '1' }))
    };
    const client = new FMClient(
      secrets,
      { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      1500,
      http as never,
      proxy as never,
      undefined,
      undefined,
      undefined,
      () => 2
    );

    await client.findRecords(profile, 'Contacts', { query: [{ 'Name': 'Ada' }] });

    expect(proxy.findRecords).toHaveBeenCalledWith(
      profile,
      'Contacts',
      { query: [{ 'Name': 'Ada' }] },
      undefined
    );
    expect(http.request).not.toHaveBeenCalled();
  });

  it('reads the developer’s choice, and ignores a value the server would not understand', () => {
    const service = (value: unknown): SettingsService =>
      new SettingsService({
        getConfiguration: () => ({ get: (key: string, fallback: unknown) => (key === 'dateFormats' ? value : fallback) }) as never
      });

    expect(service(0).getDateFormats()).toBe(0);
    expect(service(1).getDateFormats()).toBe(1);
    expect(service(2).getDateFormats()).toBe(2);
    expect(service(3).getDateFormats()).toBe(0);
    expect(service('nonsense').getDateFormats()).toBe(0);
    expect(service(undefined).getDateFormats()).toBe(0);
  });
});
