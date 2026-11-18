import { intakeDefinitionSchema, intakeLayout, migrateIntakeSource, starterById, type IntakeDefinition, type LayoutDefinition } from '@fmweb/shared';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import path from 'node:path';

export interface PreviewIntake { definition: IntakeDefinition; layout: LayoutDefinition }
const MAX_BYTES = 1048576;

/** Read only bounded regular JSON files, refusing folder/file links below the generated root. */
async function readJson(root: string, folder: string, name: string): Promise<unknown> {
  const directory = path.join(root, folder);
  if (!(await lstat(directory)).isDirectory() || (await lstat(directory)).isSymbolicLink()) throw new Error('Invalid portal directory.');
  const filename = path.join(directory, name);
  if (!(await lstat(filename)).isFile()) throw new Error('Invalid portal file.');
  const handle = await open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > MAX_BYTES) throw new Error('Invalid portal file size.');
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const read = await handle.read(buffer, length, buffer.length - length, null);
      if (!read.bytesRead) break;
      length += read.bytesRead;
    }
    if (length > MAX_BYTES) throw new Error('Portal file is too large.');
    return JSON.parse(buffer.subarray(0, length).toString('utf8')) as unknown;
  } finally { await handle.close(); }
}

/** The private preview snapshots validated data, never code or upstream credentials. Restart to apply edits. */
export class PreviewIntakeRegistry {
  private readonly loaded = new Map<string, Promise<PreviewIntake | undefined>>();
  constructor(private readonly generatedRoot = path.resolve(process.cwd(), '..')) {}

  load(id: string): Promise<PreviewIntake | undefined> {
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(id)) return Promise.resolve(undefined);
    const prior = this.loaded.get(id);
    if (prior) return prior;
    // Refuse excess targets without evicting duplicate-protection state for previous forms.
    if (this.loaded.size >= 50) return Promise.resolve(undefined);
    const result = this.read(id);
    this.loaded.set(id, result);
    // Bound in-flight reads, but a typo or invalid definition must not occupy a saved-form slot.
    void result.then((value) => { if (!value && this.loaded.get(id) === result) this.loaded.delete(id); });
    return result;
  }

  private async read(id: string): Promise<PreviewIntake | undefined> {
    try {
      const root = await realpath(this.generatedRoot);
      try { await lstat(path.join(root, 'intakes')); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return this.starter(id);
        throw error;
      }
      let definition: IntakeDefinition;
      try { definition = intakeDefinitionSchema.parse(await readJson(root, 'intakes', `${id}.intake.json`)); }
      catch (error) {
        // No saved app with this identifier yet: the synthetic starter answers for it.
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return this.starter(id);
        throw error;
      }
      if (definition.id !== id || definition.environmentId !== 'sample') return undefined;
      const source = migrateIntakeSource(definition, await readJson(root, 'intake-layouts', `${definition.layoutId}.layout.json`));
      return { definition, layout: intakeLayout(definition, source) };
    } catch { return undefined; }
  }

  /** The synthetic starter for an identifier the catalogue knows, or nothing. */
  private starter(id: string): PreviewIntake | undefined {
    const starter = starterById(id);
    return starter ? starter.example() : undefined;
  }
}
export const previewIntakes = new PreviewIntakeRegistry();
