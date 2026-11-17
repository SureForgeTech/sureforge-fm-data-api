import * as vscode from 'vscode';
import { eventRegistrationExample, type IntakeDefinition, type LayoutDefinition } from '@fmweb/shared';
import { designerLayoutMetadata } from '../fmweb/fieldMetadata';
import { FmWebAppPanel } from '../webviews/fmWebApp';
import { FmWebIntakeService, type SavedIntake } from '../services/fmWebIntakeService';
import { registrationAppFromFields, writableAppFields } from '../services/fmWebAppModel';
import type { FMClient } from '../services/fmClient';
import type { FmWebProjectService } from '../services/fmWebProjectService';
import type { FmWebRuntimeGenerator } from '../services/fmWebRuntimeGenerator';
import type { ProfileStore } from '../services/profileStore';
import type { ConnectionProfile } from '../types/fm';

interface CreateAppDependencies {
  context: vscode.ExtensionContext;
  project: FmWebProjectService;
  generator: FmWebRuntimeGenerator;
  profileStore: ProfileStore;
  fmClient: FMClient;
}

export async function createFmWebApp(deps: CreateAppDependencies): Promise<void> {
  const { context, project, generator, profileStore, fmClient } = deps;
  const workspace = project.getWorkspaceRoot();
  if (!workspace) {
    const choice = await vscode.window.showInformationMessage('Choose a workspace folder for your FM Web app.', 'Open Folder');
    if (choice === 'Open Folder') {
      const folders = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false, openLabel: 'Use app folder' });
      if (folders?.[0]) await vscode.commands.executeCommand('vscode.openFolder', folders[0]);
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
  let saved: SavedIntake | undefined;
  let model: { definition: IntakeDefinition; layout: LayoutDefinition };
  let profile: ConnectionProfile | undefined;
  try { saved = await intakes.loadForEditing('event-registration');model = saved; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    // Missing sources are an existing app needing repair, not permission to replace its definition.
    try { await intakes.definitionPathForEdit('event-registration');throw new Error('The saved app has a missing source layout. Open Build a Portal to repair it.', { cause: error }); }
    catch (existingError) { if ((existingError as NodeJS.ErrnoException).code !== 'ENOENT') throw existingError; }
    const source = await vscode.window.showQuickPick([
      { label: 'Use FileMaker fields', description: 'Choose a connection, layout and registration fields', value: 'filemaker' },
      { label: 'Try sample fields', description: 'Start immediately without a FileMaker connection', value: 'sample' }
    ], { title: 'Create FM Web App · Event registration', placeHolder: 'Where should the form fields come from?', ignoreFocusOut: true });
    if (!source) return;
    if (source.value === 'sample') model = eventRegistrationExample();
    else {
      let profiles = await profileStore.listProfiles();
      if (!profiles.length) {
        const answer = await vscode.window.showInformationMessage('Add a FileMaker connection to choose its fields.', 'Add Connection');
        if (answer !== 'Add Connection') return;
        await vscode.commands.executeCommand('filemakerDataApiTools.addConnectionProfile');
        profiles = await profileStore.listProfiles();if (!profiles.length) return;
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
      if (!writable.length) throw new Error('This layout has no writable, nonglobal fields. Choose a registration layout with editable fields.', { cause: error });
      const fields = await vscode.window.showQuickPick(writable.map((field) => ({ label: field.name,
        description: field.type ?? 'Text', picked: /^(?:full[ _]?name|first[ _]?name|last[ _]?name|email(?:[ _]?address)?|session|notes)$/i.test(field.name.trim()), field })),
      { title: 'Create FM Web App · Fields', placeHolder: 'Select 1–100 registration fields. Calculations, summaries, containers and globals are excluded.', canPickMany: true, ignoreFocusOut: true });
      if (!fields) return;
      model = registrationAppFromFields(selected.name, fields.map((item) => item.field));
    }
  }
  assertAvailable();
  let preparedProfile = false;
  FmWebAppPanel.open(context, model.definition, model.layout, {
    assertAvailable,
    save: async (definition) => {
      assertAvailable();
      if (!saved) {
        if (profile && !preparedProfile) {
          await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Preparing the FM Web app' }, async () => {
            await project.setActiveProfile(profile!.id);
            await project.syncMetadata(profile!);
          });
          preparedProfile = true;assertAvailable();
        }
        saved = await intakes.createApp(definition, model.layout);
      } else saved = await intakes.saveApp(definition, saved.revision);
    },
    run: async (action) => {
      assertAvailable();
      if (action === 'preview') await vscode.commands.executeCommand('filemakerDataApiTools.startFmWebPreviewServer');
      else if (action === 'layout') await vscode.commands.executeCommand('filemakerDataApiTools.openLayoutMode', { layoutId: model.layout.id });
      else {
        await vscode.commands.executeCommand('filemakerDataApiTools.generateFmWebNextApp');
        await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(generator.getGeneratedRuntimeRoot()));
      }
    }
  });
}
