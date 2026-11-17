import { createHash, randomUUID } from 'node:crypto';
import { stableRecordStringify, validateIntakeSubmission, type IntakeDefinition, type IntakeValidationError } from '@fmweb/shared';

export type IntakeAdapterResult = { status: 'accepted'; receipt: string } | { status: 'rejected' | 'uncertain' };
export interface IntakeAdapter {
  createRecord(fieldData: Readonly<Record<string, string | number>>): Promise<IntakeAdapterResult>;
}
export type IntakeOutcome =
  | { status: 'accepted'; receipt: string }
  | { status: 'invalid'; errors: IntakeValidationError[] }
  | { status: 'pending' | 'uncertain' | 'rejected' | 'capacity' | 'conflict' };
interface Attempt {
  fingerprint: string;
  outcome: { status: 'pending' | 'uncertain' } | { status: 'accepted'; receipt: string };
}

/** Bounded process-local duplicate protection for the private synthetic preview, not durable exactly-once delivery. */
export class IntakeSubmissionService {
  private readonly attempts = new Map<string, Attempt>();

  constructor(private readonly definition: IntakeDefinition, private readonly adapter: IntakeAdapter,
    private readonly capacity = 1000) {}

  async submit(submissionId: string, input: unknown): Promise<IntakeOutcome> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)) {
      return { status: 'invalid', errors: [{ code: 'shape', message: 'A submission identifier is required.' }] };
    }
    const checked = validateIntakeSubmission(this.definition, input);
    if (!checked.valid) return { status: 'invalid', errors: checked.errors };
    const fingerprint = createHash('sha256').update(stableRecordStringify(checked.fieldData)).digest('hex');
    const prior = this.attempts.get(submissionId);
    if (prior) return prior.fingerprint === fingerprint ? { ...prior.outcome } : { status: 'conflict' };
    if (this.attempts.size >= this.capacity) return { status: 'capacity' };
    const attempt: Attempt = { fingerprint, outcome: { status: 'pending' } };
    this.attempts.set(submissionId, attempt);
    try {
      const result = await this.adapter.createRecord(checked.fieldData);
      if (result.status === 'rejected') {
        this.attempts.delete(submissionId);
        return { status: 'rejected' };
      }
      attempt.outcome = result.status === 'accepted' && /^[a-z0-9-]{1,80}$/i.test(result.receipt)
        ? { status: 'accepted', receipt: result.receipt } : { status: 'uncertain' };
    } catch {
      // Never retry a write whose result is unknown, and never reflect an upstream error or input.
      attempt.outcome = { status: 'uncertain' };
    }
    return { ...attempt.outcome };
  }
}

export function createSyntheticIntakeAdapter(): IntakeAdapter {
  return { async createRecord() { return { status: 'accepted', receipt: `sample-${randomUUID()}` }; } };
}
