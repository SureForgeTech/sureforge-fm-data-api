import { mkdir, mkdtemp, readFile, rm } from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventRegistrationExample, type feedbackRequestExample } from '@fmweb/shared';
import { createFmWebApp, PENDING_FIRST_RUN_KEY } from '../../src/commands/createFmWebApp';
import { FmWebAppPanel, type AppEditorActions } from '../../src/webviews/fmWebApp';
import { FmWebIntakeService } from '../../src/services/fmWebIntakeService';
let root: string;
let open: ReturnType<typeof vi.spyOn>;
function fixture() {
  const project = { getWorkspaceRoot: (): string | undefined => root, getProjectRoot: () => path.join(root, '.fmweb'),
    getLayoutsDirPath: () => path.join(root, '.fmweb', 'layouts'), isWorkspaceTrusted: () => true,
    ensureProjectInitialized: vi.fn(async () => { await mkdir(path.join(root, '.fmweb', 'layouts'), { recursive: true });return {} as never; }),
    setActiveProfile: vi.fn(async () => undefined), syncMetadata: vi.fn(async () => undefined) };
  const fmClient = { listLayouts: vi.fn(async () => [' Registrations ']), getLayoutMetadata: vi.fn(async () => ({ fieldMetaData: [
    { name: ' Full Name ', type: 'normal', result: 'text' }, { name: 'Email', type: 'normal', result: 'text' },
    { name: 'Calc', type: 'calculation', result: 'number' }, { name: 'Global', type: 'normal', result: 'text', global: true }
  ] })) };
  const profile = { id: 'profile', name: 'Dev', database: 'Events' };
  const context = { extensionUri: { fsPath: '/extension' }, subscriptions: [], globalState: { get: vi.fn(), update: vi.fn(async () => undefined) } };
  const deps = { context, project,
    generator: { getGeneratedRuntimeRoot: () => path.join(root, '.fmweb/generated/runtime-next') },
    profileStore: { listProfiles: vi.fn(async () => [profile]) }, fmClient };
  return { deps, project, fmClient, context };
}
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'fm-create-flow-'));vi.clearAllMocks();
  (vscode.workspace as { isTrusted: boolean }).isTrusted = true;
  vi.spyOn(FmWebAppPanel, 'revealIfOpen').mockReturnValue(false);
  open = vi.spyOn(FmWebAppPanel, 'open').mockImplementation(() => undefined);
});
afterEach(async () => { vi.restoreAllMocks();await rm(root, { recursive: true, force: true }); });
function actions(): AppEditorActions { return open.mock.calls[0]![3] as AppEditorActions; }
type Picker = { label?: string; value?: string; picked?: boolean };
/**
 * Answer each QuickPick in turn. The first pick of a step names the wanted label;
 * the steps after it (connection, layout) take their first item.
 */
function pickSequence(wanted: string[]) {
  let index = 0;
  vi.mocked(vscode.window.showQuickPick).mockImplementation(async (items, options) => {
    const choices = items as unknown as Picker[];
    if (options?.canPickMany) return choices as never;
    const wantedLabel = wanted[index++];
    if (!wantedLabel) return choices[0] as never;
    return (choices.find((item) => item.label === wantedLabel) ?? choices[0]) as never;
  });
}
function pickFileMaker() { pickSequence(['Event Registration', 'Use FileMaker fields']); }
describe('Create FM Web App production controller', () => {
  it('preselects prompt matches from the chosen layout and opens a draft without saving or starting preview', async () => {
    const { deps, project } = fixture();
    vi.mocked(vscode.window.showInputBox).mockResolvedValue('Require attendee name and email, add optional session');
    let step = 0;
    vi.mocked(vscode.window.showQuickPick).mockImplementation(async (items, options) => {
      const choices = items as unknown as Array<Picker & { picked?: boolean }>;
      if (options?.canPickMany) {
        expect(choices.map(({ label, picked }) => [label, picked])).toEqual([[' Full Name ', true], ['Email', true]]);
        return choices.filter((item) => item.picked) as never;
      }
      if (step++ === 0) return (choices.find((item) => item.label === 'Event Registration') ?? choices[0]) as never;
      return (choices.find((item) => item.label === 'Draft form from a prompt') ?? choices[0]) as never;
    });
    await createFmWebApp(deps as never);
    const definition = open.mock.calls[0]![1] as ReturnType<typeof eventRegistrationExample>['definition'];
    expect(definition.fields.map((field) => [field.fmFieldName, field.required])).toEqual([[' Full Name ', true], ['Email', true]]);
    expect(open.mock.calls[0]![4]).toMatchObject({ unmatched: expect.arrayContaining([expect.stringMatching(/session/i)]) });
    expect(project.ensureProjectInitialized).not.toHaveBeenCalled();
    expect(project.syncMetadata).not.toHaveBeenCalled();
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    await actions().save(definition);
    await actions().run('preview');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.startFmWebPreviewServer', { intakeId: 'event-registration' });
  });

  it('gives the same starter the same title on the sample and the FileMaker path', async () => {
    const { deps } = fixture();
    pickSequence(['Feedback or Request Form', 'Try sample fields']);
    await createFmWebApp(deps as never);
    const sampled = open.mock.calls[0]![1] as ReturnType<typeof feedbackRequestExample>['definition'];
    expect(sampled.title).toBe('Feedback or request form');
    open.mockClear();
    pickSequence(['Feedback or Request Form', 'Use FileMaker fields']);
    await createFmWebApp(deps as never);
    const fromFileMaker = open.mock.calls[0]![1] as ReturnType<typeof feedbackRequestExample>['definition'];
    expect(fromFileMaker.title).toBe('Feedback or request form');
    expect(fromFileMaker.submitLabel).toBe('Send');
    expect(fromFileMaker.id).toBe('feedback-request');
  });

  it('keeps the event registration title on the FileMaker path', async () => {
    const { deps } = fixture();pickFileMaker();
    await createFmWebApp(deps as never);
    const definition = open.mock.calls[0]![1] as ReturnType<typeof eventRegistrationExample>['definition'];
    expect(definition.title).toBe('Event registration');
    expect(definition.submitLabel).toBe('Register');
    expect(definition.id).toBe('event-registration');
  });

  it('refuses a starter identifier the wizard does not offer', async () => {
    const { deps } = fixture();
    await expect(createFmWebApp(deps as never, { starter: 'not-a-starter' })).rejects.toThrow('starter');
    expect(open).not.toHaveBeenCalled();
  });

  it('offers both starters and uses the chosen starter for the sample app, its file and its preview route', async () => {
    const { deps, project } = fixture();
    pickSequence(['Feedback or Request Form', 'Try sample fields']);
    await createFmWebApp(deps as never);
    const definition = open.mock.calls[0]![1] as ReturnType<typeof feedbackRequestExample>['definition'];
    expect(definition.id).toBe('feedback-request');
    expect(definition.title).toBe('Feedback or request form');
    expect(definition.fields.map((field) => field.fmFieldName)).toEqual([' Full Name ', 'Email Address', 'Topic', 'Message']);
    await actions().save(definition);
    await expect(readFile(path.join(root, '.fmweb/intakes/feedback-request.intake.json'), 'utf8')).resolves.toContain('feedback-request');
    await actions().run('preview');
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.startFmWebPreviewServer', { intakeId: 'feedback-request' });
    expect(project.ensureProjectInitialized).toHaveBeenCalled();
  });

  it('cancelling the starter step opens no editor and writes no app files', async () => {
    const { deps, project } = fixture();
    vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);
    await createFmWebApp(deps as never);
    expect(open).not.toHaveBeenCalled();
    expect(project.ensureProjectInitialized).not.toHaveBeenCalled();
  });

  it('cancels the prompt without selecting fields, saving files or opening an editor', async () => {
    const { deps, project } = fixture();pickFileMaker();
    vi.mocked(vscode.window.showInputBox).mockResolvedValue(undefined);
    await createFmWebApp(deps as never, { source: 'draft' });
    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(3);
    expect(open).not.toHaveBeenCalled();
    expect(project.ensureProjectInitialized).not.toHaveBeenCalled();
  });

  it('resumes prompt drafting after creating the first connection', async () => {
    const { deps } = fixture();deps.profileStore.listProfiles.mockResolvedValue([]);
    vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Add Connection' as never);
    pickSequence(['Event Registration', 'Use FileMaker fields']);
    await createFmWebApp(deps as never, { source: 'draft' });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.addConnectionProfile', { continueToFmWebApp: true, draft: true, starter: 'event-registration' });
    expect(open).not.toHaveBeenCalled();
  });

  it('keeps the chosen starter when it hands over to the connection wizard', async () => {
    const { deps } = fixture();deps.profileStore.listProfiles.mockResolvedValue([]);
    vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Add Connection' as never);
    pickSequence(['Feedback or Request Form', 'Use FileMaker fields']);
    await createFmWebApp(deps as never);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.addConnectionProfile', { continueToFmWebApp: true, starter: 'feedback-request' });
    expect(open).not.toHaveBeenCalled();
  });

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
    await actions().run('filemaker');expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.startFmWebPreviewServer', { intakeId: 'event-registration', registrationMode: 'filemaker' });
    await actions().save({ ...model, title: 'Updated day' });expect(project.syncMetadata).toHaveBeenCalledOnce();
  });
  it('continues through connection creation when no profiles exist', async () => {
    const { deps } = fixture();deps.profileStore.listProfiles.mockResolvedValue([]);pickFileMaker();
    vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Add Connection' as never);
    await createFmWebApp(deps as never);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.addConnectionProfile', { continueToFmWebApp: true, starter: 'event-registration' });
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
    pickSequence(['Event Registration']);
    await createFmWebApp(deps as never);
    expect(fmClient.listLayouts).not.toHaveBeenCalled();
    expect(vscode.window.showQuickPick).toHaveBeenCalledTimes(1);
    await actions().save({ ...app.definition, title: 'Resumed app' });
    expect((await new FmWebIntakeService(project).load('event-registration')).definition.title).toBe('Resumed app');
  });
  it.each([0, 1, 2, 3, 4])('cancels at setup stage %s without creating app files', async (cancelAt) => {
    const { deps, project } = fixture();let step = 0;
    vi.mocked(vscode.window.showQuickPick).mockImplementation(async (items, options) => {
      if (step++ === cancelAt) return undefined;
      const choices = items as unknown as Array<Record<string, unknown>>;
      if (options?.canPickMany) return choices as never;
      // The steps are the starter, the data source, the connection, the layout and the fields.
      if (options?.title === 'Create FM Web App · Data') return (choices.find((item) => item.value === 'filemaker') ?? choices[0]) as never;
      return choices[0] as never;
    });
    await createFmWebApp(deps as never);expect(open).not.toHaveBeenCalled();expect(project.ensureProjectInitialized).not.toHaveBeenCalled();
  });
  it('supports sample fields and refuses changed-workspace saves', async () => {
    const { deps } = fixture();pickSequence(['Event Registration', 'Try sample fields']);
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
  it('remembers the wizard while a folder is opened so it can resume after the window reloads', async () => {
    const { deps, context, project } = fixture();
    project.getWorkspaceRoot = () => undefined;
    vi.mocked(vscode.window.showInformationMessage).mockResolvedValue('Open Folder' as never);
    vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([{ fsPath: '/tmp/app' }] as never);
    await createFmWebApp(deps as never);
    expect(context.globalState.update).toHaveBeenCalledWith(PENDING_FIRST_RUN_KEY, true);
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('vscode.openFolder', { fsPath: '/tmp/app' });
    expect(open).not.toHaveBeenCalled();
  });
});
