import { eventRegistrationExample, intakeDefinitionSchema, intakeLayout, layoutDefinitionSchema, type IntakeDefinition, type LayoutDefinition } from '@fmweb/shared';
import { constants } from 'fs';
import { lstat, mkdir, open, readdir, realpath, writeFile } from 'fs/promises';
import path from 'path';
import type { FmWebProjectService } from './fmWebProjectService';
import { assertSafeOutputFolder, writeGeneratedFiles } from './generatedFileWriter';
import { resolveConfinedFile } from '../utils/pathConfinement';

export interface PortalPreviewFiles { intakes: Map<string, Buffer>; layouts: Map<string, Buffer> }

export interface SavedIntake {
  definition: IntakeDefinition;
  layout: LayoutDefinition;
  definitionPath: string;
  layoutPath: string;
}

/** Data-only starter files belong to the user. Resuming never overwrites either file. */
export class FmWebIntakeService {
  constructor(private readonly project: Pick<FmWebProjectService, 'getProjectRoot' | 'getWorkspaceRoot' | 'isWorkspaceTrusted' | 'ensureProjectInitialized' | 'getLayoutsDirPath'>) {}

  private async confined(file: string): Promise<string> {
    if (!this.project.isWorkspaceTrusted()) throw new Error('Workspace trust is required to build a portal.');
    const root = this.project.getWorkspaceRoot();
    if (!root) throw new Error('Open a workspace folder to build a portal.');
    return (await resolveConfinedFile(file, root, [root, await realpath(root)])).path;
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
      if (existing.layoutId !== layout.id) return this.load(existing.id);
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

  public async load(id: string): Promise<SavedIntake> {
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(id)) throw new Error('Invalid portal identifier.');
    const definitionPath = await this.confined(path.join(this.project.getProjectRoot(), 'intakes', `${id}.intake.json`));
    const definition = intakeDefinitionSchema.parse(await this.read(definitionPath));
    if (definition.id !== id) throw new Error('Portal filename and identifier must match.');
    if (definition.environmentId !== 'sample') throw new Error('This portal preview supports only the sample environment. No live FileMaker adapter is configured.');
    const layoutPath = await this.confined(path.join(this.project.getLayoutsDirPath(), `${definition.layoutId}.layout.json`));
    const layout = layoutDefinitionSchema.parse(await this.read(layoutPath));
    // Validate every mapping, not just the form JSON shape.
    intakeLayout(definition, layout);
    return { definition, layout, definitionPath, layoutPath };
  }

  public async exportSnapshot(snapshot: PortalPreviewFiles): Promise<string[]> {
    const files: Array<{ path: string; content: string }> = [];
    for (const [folder, entries] of [['intakes', snapshot.intakes], ['layouts', snapshot.layouts]] as const) {
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

  public async previewFiles(): Promise<PortalPreviewFiles> {
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
