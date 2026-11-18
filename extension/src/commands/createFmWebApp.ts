import * as vscode from 'vscode';
import { eventRegistrationExample, intakeStarters, starterById, type IntakeDefinition, type IntakeStarter, type LayoutDefinition } from '@fmweb/shared';
import { designerLayoutMetadata } from '../fmweb/fieldMetadata';
import { FmWebAppPanel } from '../webviews/fmWebApp';
import { FmWebIntakeService, type SavedIntake } from '../services/fmWebIntakeService';
import { registrationAppFromFields, writableAppFields } from '../services/fmWebAppModel';
import { MAX_FORM_PROMPT_LENGTH, suggestPromptFields } from '../services/fmWebPromptDraft';
import type { FMClient } from '../services/fmClient';
import type { FmWebProjectService } from '../services/fmWebProjectService';
import type { FmWebRuntimeGenerator } from '../services/fmWebRuntimeGenerator';
import type { ProfileStore } from '../services/profileStore';
import type { ConnectionProfile } from '../types/fm';

/** The key the pending first-run wizard is stored under while a folder is opened. */
export const PENDING_FIRST_RUN_KEY = 'filemaker.pendingFirstRunWizard';

interface CreateAppDependencies {
  context: vscode.ExtensionContext;
  project: FmWebProjectService;
  generator: FmWebRuntimeGenerator;
  profileStore: ProfileStore;
  fmClient: FMClient;
}

export interface CreateAppOptions {
  source?: 'filemaker' | 'draft';
  changeSource?: boolean;
  /** The starter the user picked. The wizard asks for one when this is absent. */
  starter?: string;
}

/** The starter the wizard offers, or the one it was given. */
function pickStarter(chosen?: string): IntakeStarter | undefined {
  if (chosen) return starterById(chosen);
  return undefined;
}

export async function createFmWebApp(deps: CreateAppDependencies, options: CreateAppOptions = {}): Promise<void> {
  const { context, project, generator, profileStore, fmClient } = deps;
  const workspace = project.getWorkspaceRoot();
  if (!workspace) {
    const choice = await vscode.window.showInformationMessage('Choose a workspace folder for your FM Web app.', 'Open Folder');
    if (choice === 'Open Folder') {
      const folders = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false, openLabel: 'Use app folder' });
      if (folders?.[0]) {
        // Opening a folder reloads the window, so the wizard is remembered and resumed on activation.
        await context.globalState.update(PENDING_FIRST_RUN_KEY, true);
        await vscode.commands.executeCommand('vscode.openFolder', folders[0]);
      }
    }
    return;
  }
  const assertAvailable = (): void => {
    if (!vscode.workspace.isTrusted) throw new Error('Trust this workspace before creating or saving an FM Web app.');
    if (project.getWorkspaceRoot() !== workspace) throw new Error('The workspace changed. Close this app tab and run Create FM Web App again.');
  };
  assertAvailable();
  if (FmWebAppPanel.revealIfOpen()) return;
  const intakes = new FmWebIntakeService(project);
  // The starter is the app's identity: it names the saved app, its file and its preview route.
  let starter = pickStarter(options.starter);
  if (!starter && !options.changeSource) {
    const picked = await vscode.window.showQuickPick(intakeStarters.map((item) => ({ label: item.label, description: item.description, starter: item })), {
      title: 'Create FM Web App · Starter', placeHolder: 'What kind of form are you making?', ignoreFocusOut: true
    });
    if (!picked) return;
    starter = picked.starter;
  }
  const appId = starter?.id ?? 'event-registration';
  let saved: SavedIntake | undefined;
  let model: { definition: IntakeDefinition; layout: LayoutDefinition };
  let profile: ConnectionProfile | undefined;
  let draft: ReturnType<typeof suggestPromptFields> | undefined;
  try { saved = await intakes.loadForEditing(appId);model = saved; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    // Missing sources are an existing app needing repair, not permission to replace its definition.
    try { await intakes.definitionPathForEdit(appId);throw new Error('The saved app has a missing source layout. Open Build a Portal to repair it.', { cause: error }); }
    catch (existingError) { if ((existingError as NodeJS.ErrnoException).code !== 'ENOENT') throw existingError; }
  }
  if (!saved || options.changeSource) {
    const source = options.source ? { value: options.source } : await vscode.window.showQuickPick([
      { label: 'Try sample fields', description: 'Start immediately without a FileMaker connection', value: 'sample' },
      { label: 'Use FileMaker fields', description: 'Choose a connection, layout and registration fields', value: 'filemaker' },
      { label: 'Draft form from a prompt', description: 'Describe a form and review suggested FileMaker fields', value: 'draft' }
    ], { title: 'Create FM Web App · Data', placeHolder: 'Where should the form fields come from?', ignoreFocusOut: true });
    if (!source) return;
    if (source.value === 'sample') model = (starter?.example() ?? eventRegistrationExample());
    else {
      const profiles = await profileStore.listProfiles();
      if (!profiles.length) {
        const answer = await vscode.window.showInformationMessage('Add a FileMaker connection to choose its fields.', 'Add Connection');
        if (answer !== 'Add Connection') return;
        await vscode.commands.executeCommand('filemakerDataApiTools.addConnectionProfile', {
          continueToFmWebApp: true, ...(source.value === 'draft' ? { draft: true } : {}), ...(starter ? { starter: starter.id } : {})
        });
        return;
      }
      const picked = await vscode.window.showQuickPick(profiles.map((item) => ({ label: item.name, description: item.database, profile: item })),
        { title: 'Create FM Web App · Connection', placeHolder: 'Choose the FileMaker solution', ignoreFocusOut: true });
      if (!picked) return;profile = picked.profile;
      const layouts = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Reading FileMaker layouts' }, () => fmClient.listLayouts(profile!));
      const selected = await vscode.window.showQuickPick(layouts.map((name) => ({ label: name, name })),
        { title: 'Create FM Web App · Layout', placeHolder: 'Choose the layout containing registration fields', ignoreFocusOut: true });
      if (!selected) return;
      const metadata = await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Reading registration fields' }, () => fmClient.getLayoutMetadata(profile!, selected.name, { recordHistory: false }));
      const all = designerLayoutMetadata(selected.name, metadata).fields;
      const writable = writableAppFields(all);
      if (!writable.length) throw new Error('This layout has no writable, nonglobal fields. Choose a registration layout with editable fields.');
      if (source.value === 'draft') {
        const prompt = await vscode.window.showInputBox({
          title: 'Draft form from a prompt',
          prompt: 'Describe the fields you want. Suggestions use this layout’s field names.',
          placeHolder: 'Require attendee name and email, add an optional session',
          ignoreFocusOut: true,
          validateInput: (value) => !value.trim() ? 'Describe at least one field.'
            : value.length > MAX_FORM_PROMPT_LENGTH ? 'Use 2,000 characters or fewer.' : undefined
        });
        if (!prompt?.trim() || prompt.length > MAX_FORM_PROMPT_LENGTH) return;
        draft = suggestPromptFields(prompt, writable);
      }
      const suggested = new Map(draft?.fields.map((item) => [item.field.name, item]));
      const suggestedFields = draft?.fields.map((item) => item.field) ?? [];
      const ordered = [...suggestedFields, ...writable.filter((field) => !suggested.has(field.name))];
      const fields = await vscode.window.showQuickPick(ordered.map((field) => ({
        label: field.name,
        description: suggested.has(field.name) ? 'Suggested' : field.type ?? 'Text',
        picked: draft ? suggested.has(field.name) : /^(?:full[ _]?name|first[ _]?name|last[ _]?name|email(?:[ _]?address)?|session|notes)$/i.test(field.name.trim()),
        field
      })), {
        title: draft ? 'Review suggested FileMaker fields' : 'Create FM Web App · Fields',
        placeHolder: draft && !suggested.size
          ? 'No confident matches. Choose the FileMaker fields for your form.'
          : 'Select 1–100 writable registration fields.',
        canPickMany: true, ignoreFocusOut: true
      });
      if (!fields) return;
      model = registrationAppFromFields(selected.name, fields.map((item) => item.field), { id: appId, title: starter?.label });
    }
  }
  if (saved && options.changeSource) {
    const previous = saved;
    model = { ...model!, definition: { ...previous.definition, layoutId: model!.layout.id, fields: model!.definition.fields.map((field) => {
      const existing = previous.layout.fmLayoutName === model!.layout.fmLayoutName
        ? previous.definition.fields.find((item) => item.fmFieldName === field.fmFieldName) : undefined;
      return existing ? { ...existing, id: field.id, fmFieldName: field.fmFieldName } : field;
    }) } };
  }
  if (draft) {
    if (draft.title) model!.definition.title = draft.title;
    const suggested = new Map(draft.fields.map((item) => [item.field.name, item]));
    for (const field of model!.definition.fields) {
      const suggestion = suggested.get(field.fmFieldName);
      if (suggestion?.required !== undefined) field.required = suggestion.field.required === true || suggestion.required;
    }
  }
  assertAvailable();
  let preparedProfile = false;
  const selectedModel = model!;
  FmWebAppPanel.open(context, selectedModel.definition, selectedModel.layout, {
    assertAvailable,
    save: async (definition) => {
      assertAvailable();
      if (!saved || saved.layout.id !== selectedModel.layout.id) {
        if (profile && !preparedProfile) {
          await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Preparing the FM Web app' }, async () => {
            await project.setActiveProfile(profile!.id);
            await project.syncMetadata(profile!);
          });
          preparedProfile = true;assertAvailable();
        }
        saved = saved ? await intakes.saveApp(definition, saved.revision, selectedModel.layout) : await intakes.createApp(definition, selectedModel.layout);
      } else saved = await intakes.saveApp(definition, saved.revision);
    },
    changeSource: async (source = 'filemaker') => { await vscode.commands.executeCommand('filemakerDataApiTools.createFmWebApp', { source, changeSource: true, ...(starter ? { starter: starter.id } : {}) }); },
    run: async (action) => {
      assertAvailable();
      if (action === 'filemaker') await vscode.commands.executeCommand('filemakerDataApiTools.startFmWebPreviewServer', { intakeId: appId, registrationMode: 'filemaker' });
      else if (action === 'preview') await vscode.commands.executeCommand('filemakerDataApiTools.startFmWebPreviewServer', { intakeId: appId });
      else if (action === 'layout') await vscode.commands.executeCommand('filemakerDataApiTools.openLayoutMode', { layoutId: selectedModel.layout.id });
      else {
        await vscode.commands.executeCommand('filemakerDataApiTools.generateFmWebNextApp');
        await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(generator.getGeneratedRuntimeRoot()));
      }
    }
  }, draft);
}
