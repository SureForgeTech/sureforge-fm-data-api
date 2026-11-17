import { mkdir, mkdtemp, readFile, rm } from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventRegistrationExample } from '@fmweb/shared';
import { createFmWebApp } from '../../src/commands/createFmWebApp';
import { FmWebAppPanel, type AppEditorActions } from '../../src/webviews/fmWebApp';
import { FmWebIntakeService } from '../../src/services/fmWebIntakeService';
let root: string;
let open: ReturnType<typeof vi.spyOn>;
function fixture() {
  const project = { getWorkspaceRoot: () => root, getProjectRoot: () => path.join(root, '.fmweb'),
    getLayoutsDirPath: () => path.join(root, '.fmweb', 'layouts'), isWorkspaceTrusted: () => true,
    ensureProjectInitialized: vi.fn(async () => { await mkdir(path.join(root, '.fmweb', 'layouts'), { recursive: true });return {} as never; }),
    setActiveProfile: vi.fn(async () => undefined), syncMetadata: vi.fn(async () => undefined) };
  const fmClient = { listLayouts: vi.fn(async () => [' Registrations ']), getLayoutMetadata: vi.fn(async () => ({ fieldMetaData: [
    { name: ' Full Name ', type: 'normal', result: 'text' }, { name: 'Email', type: 'normal', result: 'text' },
    { name: 'Calc', type: 'calculation', result: 'number' }, { name: 'Global', type: 'normal', result: 'text', global: true }
  ] })) };
  const profile = { id: 'profile', name: 'Dev', database: 'Events' };
  const deps = { context: { extensionUri: { fsPath: '/extension' }, subscriptions: [] }, project,
    generator: { getGeneratedRuntimeRoot: () => path.join(root, '.fmweb/generated/runtime-next') },
    profileStore: { listProfiles: vi.fn(async () => [profile]) }, fmClient };
  return { deps, project, fmClient };
}
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'fm-create-flow-'));vi.clearAllMocks();
  (vscode.workspace as { isTrusted: boolean }).isTrusted = true;
  vi.spyOn(FmWebAppPanel, 'revealIfOpen').mockReturnValue(false);
  open = vi.spyOn(FmWebAppPanel, 'open').mockImplementation(() => undefined);
});
afterEach(async () => { vi.restoreAllMocks();await rm(root, { recursive: true, force: true }); });
function actions(): AppEditorActions { return open.mock.calls[0]![3] as AppEditorActions; }
function pickFileMaker() {
  vi.mocked(vscode.window.showQuickPick).mockImplementation(async (items, options) => {
    const choices = items as unknown as Array<Record<string, unknown>>;
    if (options?.canPickMany) return choices as never;
    return choices[0] as never;
  });
}
describe('Create FM Web App production controller', () => {
  it('chooses exact FileMaker layout/fields, excludes readonly fields, and saves before preview', async () => {
    const { deps, project, fmClient } = fixture();pickFileMaker();
    await createFmWebApp(deps as never);
    expect(fmClient.getLayoutMetadata).toHaveBeenCalledWith(expect.objectContaining({ id: 'profile' }), ' Registrations ', { recordHistory: false });
    const model = open.mock.calls[0]![1] as ReturnType<typeof eventRegistrationExample>['definition'];
    expect(model.fields.map((field) => field.fmFieldName)).toEqual([' Full Name ', 'Email']);
    expect(project.ensureProjectInitialized).not.toHaveBeenCalled();
    await actions().save({ ...model, title: 'Registration day' });await actions().run('preview');
    expect(project.setActiveProfile).toHaveBeenCalledWith('profile');expect(project.syncMetadata).toHaveBeenCalledOnce();
    const saved = JSON.parse(await readFile(path.join(root, '.fmweb/intakes/event-registration.intake.json'), 'utf8'));
    expect(saved.title).toBe('Registration day');expect(saved.fields[0].fmFieldName).toBe(' Full Name ');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.startFmWebPreviewServer', { intakeId: 'event-registration' });
    await actions().save({ ...model, title: 'Updated day' });expect(project.syncMetadata).toHaveBeenCalledOnce();
  });
  it('continues through connection creation when no profiles exist', async () => {
    const { deps } = fixture();deps.profileStore.listProfiles.mockResolvedValue([]);pickFileMaker();
    vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Add Connection' as never);
    await createFmWebApp(deps as never);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.addConnectionProfile', { continueToFmWebApp: true });
    expect(open).not.toHaveBeenCalled();
  });
  it('changes a sample app to FileMaker fields on Save and preserves the original source', async () => {
    const { deps, project } = fixture();const sample = eventRegistrationExample();
    const service = new FmWebIntakeService(project);const old = await service.createApp(sample.definition, sample.layout);
    const bytes = await readFile(old.layoutPath, 'utf8');pickFileMaker();
    await createFmWebApp(deps as never, { source: 'filemaker', changeSource: true });
    expect((await service.load('event-registration')).revision).toBe(old.revision);
    const definition = open.mock.calls[0]![1] as typeof sample.definition;
    expect(definition.title).toBe(sample.definition.title);expect(definition.fields.map((field) => field.fmFieldName)).toEqual([' Full Name ', 'Email']);
    await actions().save(definition);
    const updated = await service.load('event-registration');expect(updated.layout.fmLayoutName).toBe(' Registrations ');
    expect(updated.layout.id).not.toBe(old.layout.id);expect(await readFile(old.layoutPath, 'utf8')).toBe(bytes);
    await actions().save({ ...definition, title: 'Next edit' });
    expect((await service.load('event-registration')).definition.title).toBe('Next edit');
  });
  it('cancels a source change without modifying the saved sample', async () => {
    const { deps, project } = fixture();const sample = eventRegistrationExample();const service = new FmWebIntakeService(project);
    const old = await service.createApp(sample.definition, sample.layout);
    vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);
    await createFmWebApp(deps as never, { source: 'filemaker', changeSource: true });
    expect(open).not.toHaveBeenCalled();expect((await service.load('event-registration')).revision).toBe(old.revision);
  });
  it('resumes a saved app without repeating setup or reading the server', async () => {
    const { deps, project, fmClient } = fixture();const app = eventRegistrationExample();
    await new FmWebIntakeService(project).createApp(app.definition, app.layout);
    await createFmWebApp(deps as never);
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled();expect(fmClient.listLayouts).not.toHaveBeenCalled();
    await actions().save({ ...app.definition, title: 'Resumed app' });
    expect((await new FmWebIntakeService(project).load('event-registration')).definition.title).toBe('Resumed app');
  });
  it.each([0, 1, 2, 3])('cancels at setup stage %s without creating app files', async (cancelAt) => {
    const { deps, project } = fixture();let step = 0;
    vi.mocked(vscode.window.showQuickPick).mockImplementation(async (items, options) => {
      if (step++ === cancelAt) return undefined;
      const choices = items as unknown as Array<Record<string, unknown>>;
      return (options?.canPickMany ? choices : choices[0]) as never;
    });
    await createFmWebApp(deps as never);expect(open).not.toHaveBeenCalled();expect(project.ensureProjectInitialized).not.toHaveBeenCalled();
  });
  it('supports sample fields and refuses changed-workspace saves', async () => {
    const { deps } = fixture();vi.mocked(vscode.window.showQuickPick).mockResolvedValue({ value: 'sample' } as never);
    await createFmWebApp(deps as never);const model = open.mock.calls[0]![1] as ReturnType<typeof eventRegistrationExample>['definition'];
    const previous = root;root += '-changed';
    await expect(actions().save(model)).rejects.toThrow('workspace changed');root = previous;
  });
  it('refuses trust and does not replace a malformed existing app', async () => {
    const { deps, project } = fixture();(vscode.workspace as { isTrusted: boolean }).isTrusted = false;
    await expect(createFmWebApp(deps as never)).rejects.toThrow('Trust');
    (vscode.workspace as { isTrusted: boolean }).isTrusted = true;
    await mkdir(path.join(root, '.fmweb/intakes'), { recursive: true });
    const { writeFile } = await import('fs/promises');await writeFile(path.join(root, '.fmweb/intakes/event-registration.intake.json'), '{bad');
    await expect(createFmWebApp(deps as never)).rejects.toThrow();expect(project.setActiveProfile).not.toHaveBeenCalled();
  });
});
