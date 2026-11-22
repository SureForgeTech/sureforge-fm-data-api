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

async function clientWith(dateFormats: () => number): Promise<{ client: FMClient; http: FakeAxios; profile: ConnectionProfile }> {
  const secrets = new SecretStore(new InMemorySecretStorage() as never);
  const profile = createProfile();
  await secrets.setSessionToken(profile.id, 'token');
  const http = new FakeAxios();
  http.request.mockResolvedValue(
    createAxiosResponse({
      data: { response: { data: [{ recordId: '1', fieldData: {} }], records: [] }, messages: [{ code: '0', message: 'OK' }] }
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
  return { client, http, profile };
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

  it('sends nothing when the developer leaves the server its own default', async () => {
    const { client, http, profile } = await clientWith(() => 0);

    await client.findRecords(profile, 'Contacts', { query: [{ 'Name': 'Ada' }] });
    await client.listRecords(profile, 'Contacts');
    await client.getRecord(profile, 'Contacts', '1');

    expect(http.request.mock.calls[0]![0].data).not.toHaveProperty('dateformats');
    expect(http.request.mock.calls[1]![0].params ?? {}).not.toHaveProperty('dateformats');
    expect(http.request.mock.calls[2]![0].params ?? {}).not.toHaveProperty('dateformats');
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
