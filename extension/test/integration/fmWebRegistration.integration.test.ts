import { randomUUID } from 'crypto';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import nock from 'nock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventRegistrationExample } from '@fmweb/shared';
import { FMClient } from '../../src/services/fmClient';
import { FmWebRegistrationService } from '../../src/services/fmWebRegistrationService';
import { SecretStore } from '../../src/services/secretStore';
import type { ConnectionProfile } from '../../src/types/fm';
import { InMemorySecretStorage } from '../unit/mocks';

const server = 'https://fm-registration.integration.invalid';
const apiBase = '/fmi/data/vLatest/databases/RegistrationDB';
const layout = ' Registrations ';
const recordPath = `${apiBase}/layouts/${encodeURIComponent(layout)}/records`;
const ok = [{ code: '0', message: 'OK' }];
let root: string;
beforeEach(async () => { root = await mkdtemp(path.join(tmpdir(), 'fm-registration-http-')); });
afterEach(async () => { nock.abortPendingRequests();await rm(root, { recursive: true, force: true }); });

async function fixture(timeoutMs = 1000) {
  const profile: ConnectionProfile = { id: 'registration-integration', name: 'Synthetic registration target',
    authMode: 'direct', serverUrl: server, database: 'RegistrationDB', username: 'synthetic-user',
    apiBasePath: '/fmi/data', apiVersionPath: 'vLatest' };
  const secrets = new SecretStore(new InMemorySecretStorage() as never);
  await secrets.setPassword(profile.id, 'synthetic-test-password');
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const client = new FMClient(secrets, logger, timeoutMs);
  const app = eventRegistrationExample();
  const target = { ...app, profile, ledgerRoot: path.join(root, 'receipts'), assertAllowed: async () => undefined,
    createRecord: client.createRecord.bind(client) };
  const request = { intakeId: app.definition.id, submissionId: randomUUID(), values: {
    name: ' Synthetic Attendee ', email: 'attendee@example.invalid', session: 'Morning', notes: 'Invented registration'
  } };
  const session = nock(server).post(`${apiBase}/sessions`)
    .matchHeader('authorization', `Basic ${Buffer.from('synthetic-user:synthetic-test-password').toString('base64')}`)
    .reply(200, { response: { token: 'synthetic-registration-token' }, messages: ok });
  return { client, target, request, session, service: new FmWebRegistrationService(target) };
}

describe('registration service through the production FileMaker transport', () => {
  it('authenticates, sends the exact layout and field mapping, and replays one actual upstream record receipt', async () => {
    const { service, target, request, session } = await fixture();
    let writes = 0;
    const sent: unknown[] = [];
    const records = nock(server).persist().post(recordPath, (body: unknown) => { sent.push(body);return true; })
      .matchHeader('authorization', 'Bearer synthetic-registration-token')
      .reply(200, { response: { recordId: '123456', modId: '1' }, messages: ok })
      .on('request', () => { writes++; });

    const receipt = { status: 'accepted', receipt: 'fm-123456' };
    expect(await service.submit(request)).toEqual(receipt);
    expect(await service.submit(request)).toEqual(receipt);
    expect(await new FmWebRegistrationService(target).submit(request)).toEqual(receipt);
    expect(writes).toBe(1);
    expect(session.isDone()).toBe(true);expect(records.isDone()).toBe(true);
    expect(sent).toEqual([{ fieldData: { ' Full Name ': ' Synthetic Attendee ',
      'Email Address': 'attendee@example.invalid', Session: 'Morning', Notes: 'Invented registration' }, dateformats: 0 }]);
    const ledger = await readFile(path.join(target.ledgerRoot, `${request.submissionId}.json`), 'utf8');
    expect(JSON.parse(ledger)).toMatchObject({ status: 'accepted', receipt: 'fm-123456' });
    expect(ledger).not.toContain('attendee@example.invalid');expect(ledger).not.toContain('synthetic-test-password');
  });

  it.each(['upstream error', 'missing record id', 'timeout', 'connection reset'] as const)(
    'keeps an %s outcome uncertain through same-process and reopened retries without another HTTP write', async (failure) => {
      const { service, target, request, session } = await fixture(failure === 'timeout' ? 500 : 1000);
      let writes = 0;
      const scope = nock(server).persist().on('request', () => { writes++; });
      const records = scope.post(recordPath)
        .matchHeader('authorization', 'Bearer synthetic-registration-token');
      if (failure === 'upstream error') records.reply(500, { response: {}, messages: [{ code: '500', message: 'Synthetic upstream error' }] });
      else if (failure === 'missing record id') records.reply(200, { response: { modId: '1' }, messages: ok });
      else if (failure === 'timeout') records.delayConnection(1500).reply(200, { response: { recordId: '99' }, messages: ok });
      else records.replyWithError({ code: 'ECONNRESET', message: 'Synthetic upstream connection reset' });

      expect(await service.submit(request)).toEqual({ status: 'uncertain' });
      expect(await service.submit(request)).toEqual({ status: 'uncertain' });
      expect(await new FmWebRegistrationService(target).submit(request)).toEqual({ status: 'uncertain' });
      expect(session.isDone()).toBe(true);expect(writes).toBe(1);
      expect(JSON.parse(await readFile(path.join(target.ledgerRoot, `${request.submissionId}.json`), 'utf8'))).toMatchObject({ status: 'pending' });
    }
  );
});
