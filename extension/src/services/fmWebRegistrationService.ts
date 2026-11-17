import { constants } from 'fs';
import { createHash, randomUUID } from 'crypto';
import { lstat, mkdir, open, readdir, realpath, rename, rm } from 'fs/promises';
import path from 'path';
import { intakeLayout, stableRecordStringify, validateIntakeSubmission, type IntakeDefinition, type LayoutDefinition } from '@fmweb/shared';
import type { ConnectionProfile } from '../types/fm';
import type { FMClient } from './fmClient';

interface RegistrationTarget {
  definition: IntakeDefinition;
  layout: LayoutDefinition;
  profile: ConnectionProfile;
  ledgerRoot: string;
  /** Rechecks current workspace, session, connection identity and write policy. */
  assertAllowed(): Promise<void>;
  createRecord: Pick<FMClient, 'createRecord'>['createRecord'];
}
interface Attempt { fingerprint: string; status: 'pending' | 'accepted' | 'rejected'; receipt?: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Exclusive durable claims precede writes. Pending/unknown attempts are never automatically retried. */
export class FmWebRegistrationService {
  private readonly target: RegistrationTarget;
  private readonly targetHash: string;
  private readonly running = new Set<string>();
  constructor(target: RegistrationTarget) {
    this.target = { ...target, definition: structuredClone(target.definition), layout: structuredClone(target.layout), profile: structuredClone(target.profile) };
    if (!this.target.layout.fmLayoutName) throw new Error('A FileMaker layout is required for registration saves.');
    intakeLayout(this.target.definition, this.target.layout);
    this.targetHash = createHash('sha256').update(stableRecordStringify({ profile: this.target.profile, definition: this.target.definition, layout: this.target.layout })).digest('hex');
  }

  async submit(input: unknown): Promise<Record<string, unknown>> {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return { status: 'invalid', errors: [] };
    const payload = input as Record<string, unknown>;
    if (Object.keys(payload).some((key) => !['intakeId', 'submissionId', 'values'].includes(key))
      || payload.intakeId !== this.target.definition.id || typeof payload.submissionId !== 'string' || !UUID.test(payload.submissionId)) return { status: 'invalid', errors: [] };
    const checked = validateIntakeSubmission(this.target.definition, payload.values);
    if (!checked.valid) return { status: 'invalid', errors: checked.errors };
    try { await this.target.assertAllowed(); } catch { return { status: 'rejected' }; }
    const id = payload.submissionId.toLowerCase();
    const fingerprint = createHash('sha256').update(this.targetHash).update(stableRecordStringify(checked.fieldData)).digest('hex');
    const root = await this.directory();
    const file = path.join(root, `${id}.json`);
    const previous = await this.readAttempt(file);
    if (previous) return this.prior(id, fingerprint, previous);
    if ((await readdir(root)).filter((name) => name.endsWith('.json')).length >= 10000) return { status: 'capacity' };
    const pending: Attempt = { fingerprint, status: 'pending' };
    try {
      const claim = await open(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
      try { await claim.writeFile(JSON.stringify(pending));await claim.sync(); } finally { await claim.close(); }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const prior = await this.readAttempt(file);
      return prior ? this.prior(id, fingerprint, prior) : { status: 'uncertain' };
    }
    this.running.add(id);
    try {
      try { await this.target.assertAllowed(); }
      catch { await this.finish(file, { fingerprint, status: 'rejected' });return { status: 'rejected' }; }
      // Once dispatched, every failure (including missing response or failed ledger completion) is uncertain.
      const result = await this.target.createRecord(this.target.profile, this.target.layout.fmLayoutName!, checked.fieldData, { signal: AbortSignal.timeout(15000) });
      if (!result.recordId || !/^\d{1,80}$/.test(result.recordId)) return { status: 'uncertain' };
      const receipt = `fm-${result.recordId}`;
      await this.finish(file, { fingerprint, status: 'accepted', receipt });
      return { status: 'accepted', receipt };
    } catch { return { status: 'uncertain' }; }
    finally { this.running.delete(id); }
  }

  private prior(id: string, fingerprint: string, attempt: Attempt): Record<string, unknown> {
    if (attempt.fingerprint !== fingerprint) return { status: 'conflict' };
    if (attempt.status === 'pending') return { status: this.running.has(id) ? 'pending' : 'uncertain' };
    return attempt.status === 'accepted' ? { status: 'accepted', receipt: attempt.receipt } : { status: 'rejected' };
  }

  private async directory(): Promise<string> {
    const root = path.resolve(this.target.ledgerRoot);
    // Parent is extension-owned global storage, never a workspace-supplied path.
    await mkdir(path.dirname(root), { recursive: true });
    const parent = await realpath(path.dirname(root));
    const directory = path.join(parent, path.basename(root));
    await mkdir(directory, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'EEXIST') throw error; });
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Registration storage must be a private directory.');
    return directory;
  }

  private async readAttempt(file: string): Promise<Attempt | undefined> {
    let handle;
    let identity: { dev: number; ino: number } | undefined;
    try {
      const info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink() || info.nlink > 1) throw new Error('Invalid registration receipt storage.');
      identity = info;
      handle = await open(file, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;throw error; }
    try {
      const info = await handle.stat();
      if (!identity || info.dev !== identity.dev || info.ino !== identity.ino || !info.isFile() || info.nlink > 1 || info.size > 1024) throw new Error('Invalid registration receipt storage.');
      const bytes = Buffer.alloc(1025);const read = await handle.read(bytes, 0, bytes.length, 0);
      if (read.bytesRead > 1024) throw new Error('Invalid registration receipt size.');
      let value: unknown;
      try { value = JSON.parse(bytes.subarray(0, read.bytesRead).toString('utf8')) as unknown; }
      catch {
        // A concurrent claimant may still be writing, or a crash may have left a partial claim.
        // O_EXCL below still refuses it; never overwrite or dispatch from unreadable state.
        return undefined;
      }
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid registration receipt.');
      const attempt = value as Attempt;
      if (!/^[a-f0-9]{64}$/.test(attempt.fingerprint) || !['pending', 'accepted', 'rejected'].includes(attempt.status)
        || (attempt.status === 'accepted' && (typeof attempt.receipt !== 'string' || !/^fm-\d{1,80}$/.test(attempt.receipt)))) throw new Error('Invalid registration receipt.');
      return attempt;
    } finally { await handle.close(); }
  }

  private async finish(file: string, attempt: Attempt): Promise<void> {
    const temporary = path.join(path.dirname(file), `.receipt-${randomUUID()}.tmp`);
    try {
      const handle = await open(temporary, 'wx', 0o600);
      try { await handle.writeFile(JSON.stringify(attempt));await handle.sync(); } finally { await handle.close(); }
      const info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink() || info.nlink > 1) throw new Error('Registration receipt changed.');
      await rename(temporary, file);
    } finally { await rm(temporary, { force: true }); }
  }
}
