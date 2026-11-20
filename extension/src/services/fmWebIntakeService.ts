import { CURRENT_LAYOUT_SCHEMA_VERSION, intakeDefinitionSchema, intakeLayout, layoutDefinitionSchema, migrateLayoutDefinition, migrateIntakeSource, starterById, type IntakeDefinition, type IntakeStarter, type LayoutDefinition } from '@fmweb/shared';
import { constants } from 'fs';
import { createHash, randomUUID } from 'crypto';
import { lstat, mkdir, open, readdir, realpath, rm, writeFile } from 'fs/promises';
import path from 'path';
import type { FmWebProjectService } from './fmWebProjectService';
import { assertSafeOutputFolder, writeGeneratedFiles } from './generatedFileWriter';
import { resolveConfinedFile } from '../utils/pathConfinement';
import { renameReplacing } from '../utils/renameReplacing';

export interface PortalPreviewFiles { intakes: Map<string, Buffer>; layouts: Map<string, Buffer> }

export interface SavedIntake {
  definition: IntakeDefinition;
  layout: LayoutDefinition;
  definitionPath: string;
  layoutPath: string;
  revision: string;
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
    return this.ensureStarter(starterById('event-registration')!);
  }

  /** Write the starter's own files, so a user can build the form their activity needs. */
  public async ensureStarter(starter: IntakeStarter): Promise<SavedIntake> {
    // Check trust and paths before any project mutation.
    const { definition, layout } = starter.example();
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

  public async load(id: string): Promise<SavedIntake> { return this.readApp(id, true); }

  public async loadForEditing(id: string): Promise<SavedIntake> { return this.readApp(id, false); }

  private async readApp(id: string, validateMappings: boolean): Promise<SavedIntake> {
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(id)) throw new Error('Invalid portal identifier.');
    const definitionPath = await this.confined(path.join(this.project.getProjectRoot(), 'intakes', `${id}.intake.json`));
    const rawDefinition = await this.read(definitionPath);
    const definition = intakeDefinitionSchema.parse(rawDefinition);
    if (definition.id !== id) throw new Error('Portal filename and identifier must match.');
    if (definition.environmentId !== 'sample') throw new Error('This portal starter supports only the sample environment. No live FileMaker adapter is configured.');
    const layoutPath = await this.confined(path.join(this.project.getLayoutsDirPath(), `${definition.layoutId}.layout.json`));
    const rawLayout = await this.read(layoutPath);
    const source = migrateIntakeSource(definition, rawLayout);
    const layout = await this.project.prepareLayout?.(source) ?? source;
    // Validate every mapping, not just the form JSON shape.
    if (validateMappings) intakeLayout(definition, layout);
    const revision = createHash('sha256').update(JSON.stringify([rawDefinition, rawLayout])).digest('hex');
    return { definition, layout, definitionPath, layoutPath, revision };
  }

  /** Create only missing app files. The editor's first Save is the user's creation action. */
  public async createApp(input: unknown, source: unknown): Promise<SavedIntake> {
    const definition = intakeDefinitionSchema.parse(input);
    const parsedLayout = layoutDefinitionSchema.parse(source);
    const layout = await this.project.prepareLayout?.(parsedLayout) ?? parsedLayout;
    if (!starterById(definition.id) || definition.environmentId !== 'sample') throw new Error('Unsupported app target.');
    intakeLayout(definition, layout);
    const definitionPath = await this.confined(path.join(this.project.getProjectRoot(), 'intakes', `${definition.id}.intake.json`));
    const layoutPath = await this.confined(path.join(this.project.getLayoutsDirPath(), `${layout.id}.layout.json`));
    const files = [[layoutPath, layout], [definitionPath, definition]] as const;
    for (const [, value] of files) if (Buffer.byteLength(JSON.stringify(value), 'utf8') > 1048576) throw new Error('Choose fewer fields or shorter choices; the app definition exceeds 1 MiB.');
    await this.project.ensureProjectInitialized();
    for (const [file, value] of files) {
      await assertSafeOutputFolder(path.dirname(file), await realpath(this.project.getWorkspaceRoot()!));
      await mkdir(path.dirname(file), { recursive: true });
      const target = await this.confined(file);
      try { await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' }); }
      catch (error) {
        if (file !== layoutPath || (error as NodeJS.ErrnoException).code !== 'EEXIST'
          || JSON.stringify(migrateLayoutDefinition(await this.read(file))) !== JSON.stringify(layout)) throw error;
      }
    }
    return this.load(definition.id);
  }

  /** Explicit editor saves replace the definition atomically and refuse changes made elsewhere. */
  public async saveApp(input: unknown, revision: string, replacementSource?: unknown): Promise<SavedIntake> {
    const definition = intakeDefinitionSchema.parse(input);
    const current = await this.loadForEditing(definition.id);
    if (current.revision !== revision) throw new Error('The app changed in another editor. Close this app tab and run Create FM Web App to load those changes.');
    if (definition.id !== current.definition.id || (!replacementSource && definition.layoutId !== current.definition.layoutId)
      || definition.environmentId !== current.definition.environmentId) throw new Error('The editor cannot change the app target.');
    let source = current.layout;
    if (replacementSource) {
      const parsed = layoutDefinitionSchema.parse(replacementSource);
      source = await this.project.prepareLayout?.(parsed) ?? parsed;
      if (source.id === current.layout.id) throw new Error('Choose a new source layout for replacement.');
    }
    intakeLayout(definition, source);
    const bytes = `${JSON.stringify(definition, null, 2)}\n`;
    if (Buffer.byteLength(bytes, 'utf8') > 1048576) throw new Error('The app definition exceeds 1 MiB.');
    const target = await this.confined(current.definitionPath);
    const info = await lstat(target);
    if (!info.isFile() || info.nlink > 1) throw new Error('The app definition must be a regular file with no hard links.');
    if (replacementSource) {
      const sourceBytes = `${JSON.stringify(source, null, 2)}\n`;
      if (Buffer.byteLength(sourceBytes, 'utf8') > 1048576) throw new Error('The source layout exceeds 1 MiB.');
      const layoutPath = await this.confined(path.join(this.project.getLayoutsDirPath(), `${source.id}.layout.json`));
      await assertSafeOutputFolder(path.dirname(layoutPath), await realpath(this.project.getWorkspaceRoot()!));
      try { await writeFile(layoutPath, sourceBytes, { encoding: 'utf8', mode: 0o600, flag: 'wx' }); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || JSON.stringify(migrateLayoutDefinition(await this.read(layoutPath))) !== JSON.stringify(source)) throw error;
      }
    }
    const temporary = path.join(path.dirname(target), `.app-${randomUUID()}.tmp`);
    try {
      await writeFile(temporary, bytes, { flag: 'wx', mode: info.mode & 0o777 });
      if ((await this.loadForEditing(current.definition.id)).revision !== revision) throw new Error('The app changed during Save. Close this app tab and run Create FM Web App to load those changes.');
      await this.confined(target);
      if ((await lstat(target)).nlink > 1) throw new Error('The app definition acquired a hard link during Save.');
      await renameReplacing(temporary, target);
    } finally { await rm(temporary, { force: true }); }
    return this.load(definition.id);
  }

  public async exportSnapshot(snapshot: PortalPreviewFiles): Promise<string[]> {
    const files: Array<{ path: string; content: string }> = [];
    for (const [folder, entries] of [['intakes', snapshot.intakes], ['intake-layouts', snapshot.layouts]] as const) {
      for (const [name, bytes] of entries) {
        const safeName = folder === 'intakes' ? /^[a-z][a-z0-9_-]{0,63}\.intake\.json$/ : /^[0-9a-f-]{36}\.layout\.json$/i;
        if (!safeName.test(name) || bytes.length > 1048576) throw new Error('Invalid portal export filename or size.');
        const target = await this.confined(path.join(this.project.getProjectRoot(), 'generated', folder, name));
        const parsed: unknown = JSON.parse(bytes.toString('utf8'));
        let unchanged = false;
        try { unchanged = JSON.stringify(await this.read(target)) === JSON.stringify(parsed); }
        catch (error) { if (!(error instanceof SyntaxError) && (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        if (!unchanged) files.push({ path: target, content: `${JSON.stringify(parsed, null, 2)}\n` });
      }
    }
    // Saved/exported JSON is data owned by the user. A marker from older layout generation must not grant overwrite permission.
    return writeGeneratedFiles(files, await realpath(this.project.getWorkspaceRoot()!), { confirmExisting: true });
  }

  public async previewFiles(purpose: 'preview' | 'export' = 'preview'): Promise<PortalPreviewFiles> {
    const directory = path.join(this.project.getProjectRoot(), 'intakes');
    await this.confined(path.join(directory, 'check.intake.json'));
    let entries: string[];
    try { entries = (await readdir(directory)).filter((name) => name.endsWith('.intake.json')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { intakes: new Map(), layouts: new Map() }; throw error; }
    if (entries.length > 50) throw new Error(`Cannot ${purpose} more than 50 portal definitions at a time.`);
    const intakes = new Map<string, Buffer>();
    const layouts = new Map<string, Buffer>();
    for (const name of entries.sort()) {
      let saved: SavedIntake;
      try { saved = await this.load(name.slice(0, -'.intake.json'.length)); }
      catch { throw new Error(`Cannot ${purpose} portal definition ${JSON.stringify(name)}. Check its schema, sample environment and exact mappings to an existing source layout.`); }
      intakes.set(name, Buffer.from(JSON.stringify(saved.definition)));
      layouts.set(`${saved.layout.id}.layout.json`, Buffer.from(JSON.stringify(saved.layout)));
    }
    return { intakes, layouts };
  }
}
