import { CURRENT_LAYOUT_SCHEMA_VERSION, eventRegistrationExample, intakeDefinitionSchema, intakeLayout, layoutDefinitionSchema, migrateLayoutDefinition, migrateIntakeSource, type IntakeDefinition, type LayoutDefinition } from '@fmweb/shared';
import { constants } from 'fs';
import { lstat, mkdir, open, readdir, realpath, writeFile } from 'fs/promises';
import path from 'path';
import type { FmWebProjectService } from './fmWebProjectService';
import { assertSafeOutputFolder } from './generatedFileWriter';
import { resolveConfinedFile } from '../utils/pathConfinement';

export interface SavedIntake {
  definition: IntakeDefinition;
  layout: LayoutDefinition;
  definitionPath: string;
  layoutPath: string;
}

/** Data-only starter files belong to the user. Resuming never overwrites either file. */
export class FmWebIntakeService {
  constructor(private readonly project: Pick<FmWebProjectService, 'getProjectRoot' | 'getWorkspaceRoot' | 'isWorkspaceTrusted' | 'ensureProjectInitialized' | 'getLayoutsDirPath'> & Partial<Pick<FmWebProjectService, 'prepareLayout'>>) {}

  private async confined(file: string): Promise<string> {
    if (!this.project.isWorkspaceTrusted()) throw new Error('Workspace trust is required to build a portal.');
    const root = this.project.getWorkspaceRoot();
    if (!root) throw new Error('Open a workspace folder to build a portal.');
    const canonicalRoot = await realpath(root);
    // The selected workspace root is trusted, including an OS short-name or symlink alias.
    // Validate only the relative candidate; aliases below that root remain forbidden.
    const relative = [root, canonicalRoot].map((base) => path.relative(path.resolve(base), path.resolve(file)))
      .find((candidate) => candidate !== '' && candidate !== '..' && !candidate.startsWith(`..${path.sep}`) && !path.isAbsolute(candidate));
    if (!relative) throw new Error('Portal path is outside the workspace.');
    return (await resolveConfinedFile(relative, canonicalRoot, [canonicalRoot])).path;
  }

  private async read(file: string): Promise<unknown> {
    const confined = await this.confined(file);
    if (!(await lstat(confined)).isFile()) throw new Error('Portal definition must be a regular file.');
    const handle = await open(confined, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
    try {
      const info = await handle.stat();
      if (!info.isFile() || info.size > 1048576) throw new Error('Portal definitions must be regular JSON files under 1 MiB.');
      const content = Buffer.alloc(1048577);
      let length = 0;
      while (length < content.length) {
        const read = await handle.read(content, length, content.length - length, null);
        if (!read.bytesRead) break;
        length += read.bytesRead;
      }
      if (length > 1048576) throw new Error('Portal definition is too large.');
      return JSON.parse(content.subarray(0, length).toString('utf8')) as unknown;
    } finally { await handle.close(); }
  }

  public async ensureEventStarter(): Promise<SavedIntake> {
    // Check trust and paths before any project mutation.
    const { definition, layout } = eventRegistrationExample();
    const definitionPath = await this.confined(path.join(this.project.getProjectRoot(), 'intakes', `${definition.id}.intake.json`));
    const layoutPath = await this.confined(path.join(this.project.getLayoutsDirPath(), `${layout.id}.layout.json`));
    await this.project.ensureProjectInitialized();
    // If a previous setup stopped after one file, add only its missing partner. Existing edits win.
    // A changed layoutId must not silently manufacture a different source layout.
    try {
      const existing = intakeDefinitionSchema.parse(await this.read(definitionPath));
      if (existing.layoutId !== layout.id) return this.load(definition.id);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    for (const [file, value] of [[layoutPath, layout], [definitionPath, definition]] as const) {
      await assertSafeOutputFolder(path.dirname(file), await realpath(this.project.getWorkspaceRoot()!));
      await mkdir(path.dirname(file), { recursive: true });
      const target = await this.confined(file);
      try { await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' }); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    }
    return this.load(definition.id);
  }

  /** Editing must remain possible even when the data is invalid. Still enforce trust, paths and regular bounded files. */
  public async definitionPathForEdit(id: string): Promise<string> {
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(id)) throw new Error('Invalid portal identifier.');
    const file = await this.confined(path.join(this.project.getProjectRoot(), 'intakes', `${id}.intake.json`));
    const info = await lstat(file);
    if (!info.isFile() || info.size > 1048576) throw new Error('Portal definition must be a regular file under 1 MiB.');
    return file;
  }

  /** Mapping validation must not prevent opening the source that fixes the mapping. */
  public async layoutForEdit(id: string): Promise<{ id: string; filePath: string; valid: boolean }> {
    const definitionPath = await this.definitionPathForEdit(id);
    const raw = await this.read(definitionPath);
    const layoutId = layoutDefinitionSchema.shape.id.parse(raw && typeof raw === 'object' && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).layoutId : undefined);
    const filePath = await this.confined(path.join(this.project.getLayoutsDirPath(), `${layoutId}.layout.json`));
    const info = await lstat(filePath);
    if (!info.isFile() || info.size > 1048576) throw new Error('Source layout must be a regular file under 1 MiB.');
    let valid = false;
    try {
      const source = await this.read(filePath);
      migrateLayoutDefinition(source);
      const raw = source as Record<string, unknown>;
      valid = raw.schemaVersion === CURRENT_LAYOUT_SCHEMA_VERSION && raw.id === layoutId;
    }
    catch { /* Invalid source JSON opens directly for repair, without replacing it. */ }
    return { id: layoutId, filePath, valid };
  }

  public async load(id: string): Promise<SavedIntake> {
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(id)) throw new Error('Invalid portal identifier.');
    const definitionPath = await this.confined(path.join(this.project.getProjectRoot(), 'intakes', `${id}.intake.json`));
    const definition = intakeDefinitionSchema.parse(await this.read(definitionPath));
    if (definition.id !== id) throw new Error('Portal filename and identifier must match.');
    if (definition.environmentId !== 'sample') throw new Error('This portal preview supports only the sample environment. No live FileMaker adapter is configured.');
    const layoutPath = await this.confined(path.join(this.project.getLayoutsDirPath(), `${definition.layoutId}.layout.json`));
    const source = migrateIntakeSource(definition, await this.read(layoutPath));
    const layout = await this.project.prepareLayout?.(source) ?? source;
    // Validate every mapping, not just the form JSON shape.
    intakeLayout(definition, layout);
    return { definition, layout, definitionPath, layoutPath };
  }

  public async previewFiles(): Promise<{ intakes: Map<string, Buffer>; layouts: Map<string, Buffer> }> {
    const directory = path.join(this.project.getProjectRoot(), 'intakes');
    await this.confined(path.join(directory, 'check.intake.json'));
    let entries: string[];
    try { entries = (await readdir(directory)).filter((name) => name.endsWith('.intake.json')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { intakes: new Map(), layouts: new Map() }; throw error; }
    if (entries.length > 50) throw new Error('Preview at most 50 portal definitions at a time.');
    const intakes = new Map<string, Buffer>();
    const layouts = new Map<string, Buffer>();
    for (const name of entries.sort()) {
      const saved = await this.load(name.slice(0, -'.intake.json'.length));
      intakes.set(name, Buffer.from(JSON.stringify(saved.definition)));
      layouts.set(`${saved.layout.id}.layout.json`, Buffer.from(JSON.stringify(saved.layout)));
    }
    return { intakes, layouts };
  }
}
