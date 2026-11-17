import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { FMClient } from '../../src/services/fmClient';
import { registrationAppFromFields } from '../../src/services/fmWebAppModel';
import { FmWebRegistrationService } from '../../src/services/fmWebRegistrationService';
import { SecretStore } from '../../src/services/secretStore';
import type { ConnectionProfile } from '../../src/types/fm';
import { InMemorySecretStorage } from '../unit/mocks';
import { api, type RunningMock, startMockProcess } from '../unit/mockServer/mockHelper';

const recordPath = '/layouts/Contacts/records';
let mock: RunningMock;
beforeAll(async () => { mock = await startMockProcess({ TLS: 'off', ADMIN_PORT: '0' }); }, 30000);
afterAll(async () => mock?.stop());

async function armPostCreateDrop() {
  const response = await fetch(mock.adminUrl + '/__admin/fault', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'drop-after-create',
      count: 1,
      path: '/databases/Sales/layouts/Contacts/records$'
    })
  });
  expect(response.status).toBe(200);
  await response.json();
}

describe('registration over the running mock FileMaker Data API', () => {
  it.each(['direct', 'proxy'] as const)(
    'preserves one committed record when the %s client loses the create reply',
    async (authMode) => {
      const root = await mkdtemp(path.join(tmpdir(), 'fm-registration-mock-'));
      try {
        const profile: ConnectionProfile = {
          id: `registration-mock-${authMode}`,
          name: 'Synthetic registration target',
          authMode,
          serverUrl: mock.baseUrl,
          database: 'Sales',
          username: 'tester',
          proxyEndpoint: mock.proxyUrl,
          apiBasePath: '/fmi/data',
          apiVersionPath: 'vLatest'
        };
        const secrets = new SecretStore(new InMemorySecretStorage() as never);
        await secrets.setPassword(profile.id, 'testpass1');
        await secrets.setProxyApiKey(profile.id, 'mock-proxy-key');
        const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const client = new FMClient(secrets, logger, 5000);
        const target = {
          ...registrationAppFromFields('Contacts', [{ name: 'FirstName' }, { name: 'Email' }]),
          profile,
          ledgerRoot: path.join(root, 'receipts'),
          assertAllowed: async () => undefined,
          createRecord: client.createRecord.bind(client)
        };
        const email = `receipt-${authMode}@example.invalid`;
        const request = {
          intakeId: target.definition.id,
          submissionId: randomUUID(),
          values: { 'field-1': 'Synthetic attendee', 'field-2': email }
        };

        await armPostCreateDrop();
        const http = api(mock.baseUrl);
        const { token } = await http.login('Sales');
        const rejected = await http.call('POST', '/databases/Sales' + recordPath, {
          token, body: { fieldData: { NoSuchField: 'synthetic' } }
        });
        expect(rejected.body.messages[0].code).toBe('102');

        const service = new FmWebRegistrationService(target);
        expect(await service.submit(request)).toEqual({ status: 'uncertain' });
        expect(await service.submit(request)).toEqual({ status: 'uncertain' });
        expect(await new FmWebRegistrationService(target).submit(request)).toEqual({ status: 'uncertain' });

        const stored = await client.findRecords(profile, 'Contacts', { query: [{ Email: `==${email}` }] });
        expect(stored.data).toHaveLength(1);
        expect(stored.data[0]?.fieldData).toMatchObject({ FirstName: 'Synthetic attendee', Email: email });

        type LogEntry = { method: string; path: string; fault?: string; body?: { fieldData?: { Email?: string } } };
        const logged = await fetch(mock.adminUrl + '/__admin/log');
        const { log } = await logged.json() as { log: LogEntry[] };
        const creates = log.filter((entry) => entry.method === 'POST' && entry.path === recordPath
          && entry.body?.fieldData?.Email === email);
        expect(creates).toMatchObject([{ fault: 'drop-after-create' }]);

        const next = await service.submit({
          ...request,
          submissionId: randomUUID(),
          values: { ...request.values, 'field-2': `next-${email}` }
        });
        expect(next).toMatchObject({ status: 'accepted', receipt: expect.stringMatching(/^fm-\d+$/) });
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  );
});
