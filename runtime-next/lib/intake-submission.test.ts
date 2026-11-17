import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createSyntheticIntakeAdapter, IntakeSubmissionService } from './intake-submission';
import { eventRegistrationExample } from './registration-example';

const values = { name: 'Sample Attendee', email: 'sample@example.test', session: 'Morning', notes: 'Synthetic details only' };

describe('synthetic registration and submission outcomes', () => {
  it('uses an existing layout with exact mappings and no script actions or credentials', () => {
    const { definition, layout } = eventRegistrationExample();
    expect(layout.id).toBe(definition.layoutId);
    expect(layout.fmLayoutName).toBe(' Registrations ');
    expect(layout.objects[0]).toMatchObject({ fmFieldName: ' Full Name ', label: 'Your name' });
    expect(layout.objects.every((object) => !object.behavior)).toBe(true);
    expect(JSON.stringify(definition)).not.toMatch(/password|token|https?:/i);
  });
  it('creates once using only mapped fields and replays the receipt for an identical identifier', async () => {
    const createRecord = vi.fn(createSyntheticIntakeAdapter().createRecord);
    const service = new IntakeSubmissionService(eventRegistrationExample().definition, { createRecord });
    const id = randomUUID();
    const first = await service.submit(id, values);
    expect(first).toMatchObject({ status: 'accepted', receipt: expect.stringMatching(/^sample-/) });
    expect(await service.submit(id, { ...values })).toEqual(first);
    expect(createRecord).toHaveBeenCalledTimes(1);
    expect(createRecord).toHaveBeenCalledWith({ ' Full Name ': 'Sample Attendee', 'Email Address': 'sample@example.test', Session: 'Morning', Notes: 'Synthetic details only' });
    expect(await service.submit(id, { ...values, name: 'Changed' })).toEqual({ status: 'conflict' });
    expect(createRecord).toHaveBeenCalledTimes(1);
  });
  it('refuses invalid identifiers, unknown fields and invalid values before calling an adapter', async () => {
    const createRecord = vi.fn();
    const service = new IntakeSubmissionService(eventRegistrationExample().definition, { createRecord });
    expect((await service.submit('invalid', values)).status).toBe('invalid');
    expect((await service.submit(randomUUID(), { ...values, target: 'other layout' })).status).toBe('invalid');
    expect((await service.submit(randomUUID(), { ...values, email: 'invalid' })).status).toBe('invalid');
    expect(createRecord).not.toHaveBeenCalled();
  });
  it('reserves an in-flight identifier before awaiting the write', async () => {
    let finish!: (result: { status: 'accepted'; receipt: string }) => void;
    const createRecord = vi.fn(() => new Promise<{ status: 'accepted'; receipt: string }>((resolve) => { finish = resolve; }));
    const service = new IntakeSubmissionService(eventRegistrationExample().definition, { createRecord });
    const id = randomUUID();const writing = service.submit(id, values);
    expect(await service.submit(id, values)).toEqual({ status: 'pending' });
    expect(await service.submit(id, { ...values, name: 'Different' })).toEqual({ status: 'conflict' });
    finish({ status: 'accepted', receipt: 'sample-ok' });
    expect(await writing).toEqual({ status: 'accepted', receipt: 'sample-ok' });
    expect(createRecord).toHaveBeenCalledTimes(1);
  });
  it('keeps uncertain writes reserved and never leaks or retries thrown upstream failures', async () => {
    const createRecord = vi.fn().mockRejectedValue(new Error('synthetic-password-canary'));
    const service = new IntakeSubmissionService(eventRegistrationExample().definition, { createRecord });
    const id = randomUUID();const result = await service.submit(id, values);
    expect(result).toEqual({ status: 'uncertain' });
    expect(JSON.stringify(result)).not.toContain('canary');
    expect(await service.submit(id, values)).toEqual(result);
    expect(createRecord).toHaveBeenCalledTimes(1);
  });
  it.each([{ status: 'uncertain' }, { status: 'accepted', receipt: 'https://unsafe.test/secret' }])
    ('retains an uncertain result or invalid adapter receipt without retry', async (result) => {
      const createRecord = vi.fn().mockResolvedValue(result);
      const service = new IntakeSubmissionService(eventRegistrationExample().definition, { createRecord });
      const id = randomUUID();expect(await service.submit(id, values)).toEqual({ status: 'uncertain' });
      expect(await service.submit(id, values)).toEqual({ status: 'uncertain' });expect(createRecord).toHaveBeenCalledTimes(1);
    });
  it('allows a corrected retry after a definitive rejection and bounds retained attempts', async () => {
    const createRecord = vi.fn().mockResolvedValueOnce({ status: 'rejected' }).mockResolvedValue({ status: 'accepted', receipt: 'sample-ok' });
    const service = new IntakeSubmissionService(eventRegistrationExample().definition, { createRecord }, 1);
    const id = randomUUID();expect(await service.submit(id, values)).toEqual({ status: 'rejected' });
    expect(await service.submit(id, { ...values, name: 'Corrected' })).toEqual({ status: 'accepted', receipt: 'sample-ok' });
    expect(await service.submit(randomUUID(), values)).toEqual({ status: 'capacity' });
    expect(createRecord).toHaveBeenCalledTimes(2);
  });
});
