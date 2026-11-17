import * as filesystem from 'fs/promises';
import { randomUUID } from 'crypto';
import { link, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventRegistrationExample } from '@fmweb/shared';
import { FmWebRegistrationService } from '../../src/services/fmWebRegistrationService';

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof filesystem>();
  return { ...actual, readdir: vi.fn(actual.readdir) };
});

type Target = ConstructorParameters<typeof FmWebRegistrationService>[0];
let root: string;
function fixture() {
  const app = eventRegistrationExample();
  const createRecord = vi.fn<Target['createRecord']>().mockResolvedValue({ recordId: '42' } as never);
  const assertAllowed = vi.fn(async () => undefined);
  const target: Target = { ...app, profile: { id: 'events', name: 'Registration server', authMode: 'direct',
    serverUrl: 'https://fm.example.invalid', database: ' Events ', username: 'registration' },
  ledgerRoot: path.join(root, 'receipts'), assertAllowed, createRecord };
  const request = { intakeId: 'event-registration', submissionId: randomUUID(), values: {
    name: ' Synthetic Attendee ', email: 'attendee@example.invalid', session: 'Morning', notes: ''
  } };
  return { app, target, request, createRecord, assertAllowed, service: new FmWebRegistrationService(target) };
}
beforeEach(async () => { root = await mkdtemp(path.join(tmpdir(), 'fm-registration-service-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

describe('FileMaker registration service durable write boundary', () => {
  it.each(['', '{"fingerprint":'])('does not retry an incomplete durable claim (%s)', async (bytes) => {
    const { target, service, request, createRecord } = fixture();await mkdir(target.ledgerRoot);
    const file = path.join(target.ledgerRoot, `${request.submissionId}.json`);await writeFile(file, bytes);
    const original = await vi.importActual<typeof filesystem>('fs/promises');
    const fullLedger = vi.mocked(filesystem.readdir).mockClear().mockResolvedValue(Array.from({ length: 10000 }, (_, index) => `${index}.json`) as never);
    try {
      expect(await service.submit(request)).toEqual({ status: 'uncertain' });expect(createRecord).not.toHaveBeenCalled();
      expect(fullLedger).not.toHaveBeenCalled();expect(await readFile(file, 'utf8')).toBe(bytes);
    } finally { fullLedger.mockImplementation(original.readdir).mockClear(); }
  });
  it('creates exactly the approved layout and mapped fields, retaining whitespace and only a receipt hash on disk', async () => {
    const { service, request, target, createRecord } = fixture();
    expect(await service.submit(request)).toEqual({ status: 'accepted', receipt: 'fm-42' });
    expect(createRecord).toHaveBeenCalledWith(target.profile, ' Registrations ', {
      ' Full Name ': ' Synthetic Attendee ', 'Email Address': 'attendee@example.invalid', Session: 'Morning', Notes: ''
    }, { signal: expect.any(AbortSignal) });
    expect(createRecord).toHaveBeenCalledOnce();
    const content = await readFile(path.join(target.ledgerRoot, `${request.submissionId}.json`), 'utf8');
    expect(JSON.parse(content)).toEqual({ fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/), status: 'accepted', receipt: 'fm-42' });
    for (const value of ['Synthetic Attendee', 'attendee@example.invalid', 'registration', 'fm.example.invalid']) expect(content).not.toContain(value);
  });

  it('rejects malformed requests, unknown inputs and caller-supplied targets before any write or ledger claim', async () => {
    const { service, request, target, createRecord } = fixture();
    for (const input of [null, [], { ...request, intakeId: 'other' }, { ...request, submissionId: '../escape' },
      { ...request, profileId: 'admin' }, { ...request, layout: 'Admin' }, { ...request, fieldData: { Admin: 'yes' } },
      { ...request, values: { ...request.values, admin: 'yes' } }, { ...request, values: { ...request.values, email: 'bad' } }]) {
      expect(await service.submit(input)).toMatchObject({ status: 'invalid' });
    }
    expect(createRecord).not.toHaveBeenCalled();
    await expect(readdir(target.ledgerRoot)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('returns pending for an in-flight duplicate, writes once, and returns the stored receipt thereafter', async () => {
    const { service, request, createRecord } = fixture();
    let complete!: (value: Awaited<ReturnType<Target['createRecord']>>) => void;
    createRecord.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    const first = service.submit(request);
    await vi.waitFor(() => expect(createRecord).toHaveBeenCalledOnce());
    expect(await service.submit(request)).toEqual({ status: 'pending' });
    complete({ recordId: '77' } as never);
    expect(await first).toEqual({ status: 'accepted', receipt: 'fm-77' });
    expect(await service.submit(request)).toEqual({ status: 'accepted', receipt: 'fm-77' });
    expect(createRecord).toHaveBeenCalledOnce();
  });

  it('allows only one dispatch when independent instances race to claim a new submission', async () => {
    const { service, target, request, createRecord } = fixture();
    const competing = new FmWebRegistrationService(target);
    const attempts = await Promise.allSettled([service.submit(request), competing.submit(request)]);
    expect(createRecord).toHaveBeenCalledOnce();
    expect(attempts.some((attempt) => attempt.status === 'fulfilled' && attempt.value.status === 'accepted')).toBe(true);
    expect(await new FmWebRegistrationService(target).submit(request)).toEqual({ status: 'accepted', receipt: 'fm-42' });
    expect(createRecord).toHaveBeenCalledOnce();
  });

  it('uses the same durable claim across independent service instances and after reopening', async () => {
    const { service, target, request, createRecord } = fixture();
    let complete!: (value: Awaited<ReturnType<Target['createRecord']>>) => void;
    createRecord.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
    const first = service.submit(request);
    await vi.waitFor(() => expect(createRecord).toHaveBeenCalledOnce());
    expect(await new FmWebRegistrationService(target).submit(request)).toEqual({ status: 'uncertain' });
    complete({ recordId: '91' } as never);await first;
    expect(await new FmWebRegistrationService(target).submit(request)).toEqual({ status: 'accepted', receipt: 'fm-91' });
    expect(createRecord).toHaveBeenCalledOnce();
  });

  it.each(['throw', 'missing record', 'invalid record'] as const)('keeps an uncertain %s result claimed across restarts instead of dispatching again', async (failure) => {
    const { service, target, request, createRecord } = fixture();
    if (failure === 'throw') createRecord.mockRejectedValueOnce(new Error('Unknown upstream outcome'));
    else createRecord.mockResolvedValueOnce((failure === 'missing record' ? {} : { recordId: 'not-a-record' }) as never);
    expect(await service.submit(request)).toEqual({ status: 'uncertain' });
    expect(await new FmWebRegistrationService(target).submit(request)).toEqual({ status: 'uncertain' });
    expect(createRecord).toHaveBeenCalledOnce();
    const stored = JSON.parse(await readFile(path.join(target.ledgerRoot, `${request.submissionId}.json`), 'utf8'));
    expect(stored.status).toBe('pending');
  });

  it('refuses reuse of a submission id for changed values or another approved target', async () => {
    const { service, target, request, createRecord } = fixture();await service.submit(request);
    expect(await service.submit({ ...request, values: { ...request.values, name: 'Different attendee' } })).toEqual({ status: 'conflict' });
    expect(await new FmWebRegistrationService({ ...target, profile: { ...target.profile, database: 'Another database' } }).submit(request)).toEqual({ status: 'conflict' });
    expect(createRecord).toHaveBeenCalledOnce();
  });

  it('captures the approved definition, source and profile rather than following later object mutation', async () => {
    const { service, target, request, createRecord } = fixture();
    target.profile.database = 'Changed database';target.layout.fmLayoutName = 'Changed layout';target.definition.fields[0]!.fmFieldName = 'Admin';
    expect(await service.submit(request)).toMatchObject({ status: 'accepted' });
    expect(createRecord).toHaveBeenCalledWith(expect.objectContaining({ database: ' Events ' }), ' Registrations ',
      expect.objectContaining({ ' Full Name ': ' Synthetic Attendee ' }), expect.any(Object));
  });

  it('does not create a claim or dispatch when policy is revoked before submission', async () => {
    const { service, request, target, createRecord, assertAllowed } = fixture();
    assertAllowed.mockRejectedValueOnce(new Error('Offline mode enabled'));
    expect(await service.submit(request)).toEqual({ status: 'rejected' });
    expect(createRecord).not.toHaveBeenCalled();await expect(readdir(target.ledgerRoot)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('rechecks policy after claiming and records a definite no-dispatch rejection', async () => {
    const { service, request, target, createRecord, assertAllowed } = fixture();
    assertAllowed.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Connection changed'));
    expect(await service.submit(request)).toEqual({ status: 'rejected' });
    expect(createRecord).not.toHaveBeenCalled();
    expect(await new FmWebRegistrationService(target).submit(request)).toEqual({ status: 'rejected' });
    expect(createRecord).not.toHaveBeenCalled();
  });

  it.each(['symlink', 'hardlink'] as const)('refuses a %s receipt without writing or modifying its target', async (kind) => {
    const { service, target, request, createRecord } = fixture();
    await mkdir(target.ledgerRoot);const outside = path.join(root, 'outside.json');const bytes = JSON.stringify({ status: 'pending', fingerprint: 'a'.repeat(64) });
    await writeFile(outside, bytes);const receipt = path.join(target.ledgerRoot, `${request.submissionId}.json`);
    if (kind === 'symlink') await symlink(outside, receipt);else await link(outside, receipt);
    await expect(service.submit(request)).rejects.toThrow();expect(createRecord).not.toHaveBeenCalled();
    expect(await readFile(outside, 'utf8')).toBe(bytes);
  });

  it('refuses a linked receipt directory before claiming or dispatching', async () => {
    const { service, target, request, createRecord } = fixture();
    const outside = path.join(root, 'outside');await mkdir(outside);await symlink(outside, target.ledgerRoot, 'dir');
    await expect(service.submit(request)).rejects.toThrow('private directory');expect(createRecord).not.toHaveBeenCalled();
    expect(await readdir(outside)).toEqual([]);
  });
});
