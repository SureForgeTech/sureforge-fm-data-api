import { intakeDefinitionSchema, intakeStarters, layoutDefinitionSchema, stableRecordStringify } from '@fmweb/shared';
import { FmWebRegistrationService } from '../services/fmWebRegistrationService';
import { designerLayoutMetadata } from '../fmweb/fieldMetadata';
import { writableAppFields } from '../services/fmWebAppModel';
import { bridgeRouteRefusal } from '../utils/bridgePolicy';
import { readFile } from 'fs/promises';
import path from 'path';
import { displayText } from '../ai/aiText';
import { FmWebPreviewProcess, previewInstallDescription, PREVIEW_DEV_DESCRIPTION } from '../services/fmWebPreviewProcess';
import * as vscode from 'vscode';

import type { FMClient } from '../services/fmClient';
import type { FmBridgeServer } from '../services/fmBridgeServer';
import { FmWebIntakeService } from '../services/fmWebIntakeService';
import type { FmWebProjectService } from '../services/fmWebProjectService';
import type { FmWebRuntimeGenerator } from '../services/fmWebRuntimeGenerator';
import { GenerationCancelledError, GenerationSkippedError } from '../services/generatedFileWriter';
import type { Logger } from '../services/logger';
import type { ProfileStore } from '../services/profileStore';
import type { SchemaService } from '../services/schemaService';
import type { RoleGuard } from '../enterprise/roleGuard';
import { LayoutModePanel } from '../webviews/layoutMode';
import { createFmWebApp } from './createFmWebApp';
import { resolveProfileFromArg, showCommandError } from './common';

interface RegisterFmWebProjectCommandDeps {
  context: vscode.ExtensionContext;
  profileStore: ProfileStore;
  fmClient: FMClient;
  schemaService: SchemaService;
  fmWebProjectService: FmWebProjectService;
  fmWebRuntimeGenerator: FmWebRuntimeGenerator;
  fmBridgeServer: FmBridgeServer;
  roleGuard: RoleGuard;
  logger: Logger;
  refreshExplorer: () => void;
}

export function registerFmWebProjectCommands(
  deps: RegisterFmWebProjectCommandDeps
): vscode.Disposable[] {
  const {
    context,
    profileStore,
    fmClient,
    schemaService,
    fmWebProjectService,
    fmWebRuntimeGenerator,
    fmBridgeServer,
    roleGuard,
    logger,
    refreshExplorer
  } = deps;

  const intakes = new FmWebIntakeService(fmWebProjectService);
  let preview: FmWebPreviewProcess | undefined;
  let previewStarting = false;
  let appStarting = false;
  context.subscriptions?.push({ dispose: () => { void preview?.dispose().catch(() => undefined); } });

  return [
    vscode.commands.registerCommand('filemakerDataApiTools.createFmWebApp', async (arg: unknown) => {
      if (appStarting) return;
      appStarting = true;
      try { await createFmWebApp({ context, project: fmWebProjectService, generator: fmWebRuntimeGenerator, profileStore, fmClient }, arg && typeof arg === 'object' ? { source: 'source' in arg && (arg.source === 'filemaker' || arg.source === 'draft') ? arg.source : undefined, changeSource: 'changeSource' in arg && arg.changeSource === true, starter: 'starter' in arg && typeof arg.starter === 'string' ? arg.starter : undefined } : {}); }
      catch (error) { await showCommandError(error, { fallbackMessage: 'Could not create the FM Web app.', logger, logMessage: 'Create FM Web App failed.' }); }
      finally { appStarting = false; }
    }),
    vscode.commands.registerCommand('filemakerDataApiTools.buildPortal', async () => {
      if (!vscode.workspace.isTrusted) {
        void vscode.window.showWarningMessage('Workspace trust is required to build a portal.'); return;
      }
      try {
        // The starter names the app, so it comes first, the way the wizard asks for it.
        const picked = await vscode.window.showQuickPick(
          intakeStarters.map((item) => ({ label: item.label, description: item.description, starter: item })),
          { title: 'Build a Portal · Starter', placeHolder: 'What kind of form are you making?', ignoreFocusOut: true });
        if (!picked) return;
        const starter = picked.starter;
        const action = await vscode.window.showQuickPick([
          { label: 'Create or resume the app', action: 'create', description: 'Sample data; no connection needed' },
          { label: 'Edit form and exact field mappings', action: 'edit', description: 'Title, labels, help, required fields and branding' },
          { label: 'Preview saved portal', action: 'preview', description: 'Validate definitions, then start the private sample preview' },
          { label: 'Export app scaffold', action: 'export', description: 'Generate the runtime with saved forms and layouts; preserves edits' },
          { label: 'Open source layout', action: 'layout', description: 'Continue in the existing Layout Mode designer' }
        ], { title: 'Build a Portal', placeHolder: 'Create → edit → preview → submit with invented details' });
        if (!action) return;
        const openDefinition = async (): Promise<void> => {
          const file = await intakes.definitionPathForEdit(starter.id);
          await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.file(file)));
        };
        if (action.action === 'edit') {
          await openDefinition();
          try { await intakes.load(starter.id); }
          catch { void vscode.window.showWarningMessage('The saved portal definition is open for repair. Its schema, sample environment or source mappings are invalid; preview remains unavailable until they are valid.'); }
          return;
        }
        if (action.action === 'layout') {
          const source = await intakes.layoutForEdit(starter.id);
          if (source.valid) await vscode.commands.executeCommand('filemakerDataApiTools.openLayoutMode', { layoutId: source.id });
          else {
            await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.file(source.filePath)));
            void vscode.window.showWarningMessage('The source layout is open for repair or migration. Your file was preserved. Layout Mode needs current schema JSON with the same layout ID.');
          }
          return;
        }
        let saved;
        if (action.action === 'create') {
          try { saved = await intakes.ensureStarter(starter); }
          catch (error) {
            // A typo must not lock the user out of the very file they need to repair.
            try { await openDefinition(); } catch { throw error; }
            void vscode.window.showWarningMessage('Your existing portal definition was preserved and opened for repair. Check its schema, sample environment and source layout mappings, then resume the starter.');
            return;
          }
        } else saved = await intakes.load(starter.id);
        if (action.action === 'export') {
          await vscode.commands.executeCommand('filemakerDataApiTools.generateFmWebNextApp');
        } else if (action.action === 'preview') {
          // The preview opens the app the user picked. Without it the browser lands on the
          // template's home page, whose links only reach the two starters it knows.
          await vscode.commands.executeCommand('filemakerDataApiTools.startFmWebPreviewServer', { intakeId: starter.id });
        } else {
          await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.file(saved.definitionPath)));
          void vscode.window.showInformationMessage('Portal saved in .fmweb/intakes. Edit its title, fields or branding, save, then use Build a Portal → Preview saved portal. Existing files are preserved. Only the sample environment is supported.');
        }
      } catch (error) {
        await showCommandError(error, { fallbackMessage: 'Could not build the portal. Create the starter first or repair the saved definition and source layout.', logger, logMessage: 'Build a Portal command failed.' });
      }
    }),
    vscode.commands.registerCommand('filemakerDataApiTools.initializeFmWebProject', async () => {
      if (!vscode.workspace.isTrusted) {
        vscode.window.showWarningMessage(
          'Workspace trust is required to initialize an FM Web project.'
        );
        return;
      }

      try {
        const project = await fmWebProjectService.initializeProject();
        vscode.window.showInformationMessage(
          `Initialized FM Web project at .fmweb (${project.name}).`
        );
      } catch (error) {
        await showCommandError(error, {
          fallbackMessage: 'Failed to initialize FM Web project.',
          logger,
          logMessage: 'Initialize FM Web project command failed.'
        });
      }
    }),

    vscode.commands.registerCommand('filemakerDataApiTools.selectActiveProfile', async (arg: unknown) => {
      const profile = await resolveProfileFromArg(arg, profileStore);
      if (!profile) {
        return;
      }

      try {
        await fmWebProjectService.setActiveProfile(profile.id);
        refreshExplorer();
        vscode.window.showInformationMessage(`Selected active profile: ${profile.name}.`);
      } catch (error) {
        await showCommandError(error, {
          fallbackMessage: 'Failed to set active profile for FM Web project.',
          logger,
          logMessage: 'Select active profile command failed.'
        });
      }
    }),

    vscode.commands.registerCommand('filemakerDataApiTools.syncFmWebMetadata', async (arg: unknown) => {
      if (!vscode.workspace.isTrusted) {
        vscode.window.showWarningMessage(
          'Workspace trust is required to sync FM Web metadata.'
        );
        return;
      }

      const profile = await resolveProfileFromArg(arg, profileStore, true);
      if (!profile) {
        return;
      }

      try {
        await fmWebProjectService.setActiveProfile(profile.id);
        const summary = await fmWebProjectService.syncMetadata(profile);
        schemaService.invalidateProfile(profile.id);
        fmClient.invalidateProfileCache(profile.id);
        refreshExplorer();

        vscode.window.showInformationMessage(
          `Metadata synced: ${summary.layoutCount} layouts, ${summary.scriptCount} scripts, ${summary.fieldCount} fields.`
        );
      } catch (error) {
        await showCommandError(error, {
          fallbackMessage: 'Failed to sync FM Web metadata.',
          logger,
          logMessage: 'Sync FM Web metadata command failed.'
        });
      }
    }),

    vscode.commands.registerCommand('filemakerDataApiTools.openLayoutMode', async (arg: unknown) => {
      if (!vscode.workspace.isTrusted) {
        vscode.window.showWarningMessage(
          'Workspace trust is required for Layout Mode because layout files are written to .fmweb.'
        );
        return;
      }

      try {
        await fmWebProjectService.ensureProjectInitialized();

        const record =
          arg && typeof arg === 'object' && !Array.isArray(arg)
            ? (arg as Record<string, unknown>)
            : undefined;
        const layoutId = typeof record?.layoutId === 'string' ? record.layoutId : undefined;

        LayoutModePanel.createOrShow(context, fmWebProjectService, profileStore, fmClient, logger, {
          layoutId,
          assertScriptRunAllowed: () => roleGuard.assertFeature('scriptRunner', 'Run script from Layout Mode')
        });
      } catch (error) {
        await showCommandError(error, {
          fallbackMessage: 'Failed to open Layout Mode.',
          logger,
          logMessage: 'Open Layout Mode command failed.'
        });
      }
    }),

    vscode.commands.registerCommand('filemakerDataApiTools.generateFmWebNextApp', async () => {
      if (!vscode.workspace.isTrusted) {
        vscode.window.showWarningMessage(
          'Workspace trust is required to generate the FM Web runtime template.'
        );
        return;
      }

      try {
        const portalFiles = await intakes.previewFiles('export');
        const files = await fmWebRuntimeGenerator.inspectPreviewFiles();
        if (files.length) {
          const listing = files.map((file) => displayText(file, Infinity)).join('\n');
          if (listing.length > 12000) throw new Error('Too many runtime files to show safely. Regenerate fewer files at a time.');
          const choice = await vscode.window.showWarningMessage(
            `Regenerate the runtime from the shipped template? This deletes exactly these files or folders (including their contents):\n\n${listing}`,
            { modal: true }, 'Regenerate from template'
          );
          if (choice !== 'Regenerate from template') return;
          await fmWebRuntimeGenerator.removePreviewFiles(files);
        }
        const summary = await fmWebRuntimeGenerator.generateRuntimeAppTemplate();
        vscode.window.showInformationMessage(
          `Generated Next.js runtime template in .fmweb/generated/runtime-next (${summary.created.length} created, ${summary.updated.length} updated, ${summary.skipped.length} skipped).`
        );
        warnAboutEditedManagedFiles(summary.needsManualUpdate);
        try {
          const skippedPortalFiles = await intakes.exportSnapshot(portalFiles);
          if (skippedPortalFiles.length) void vscode.window.showWarningMessage('Some existing portal data files were preserved. The exported app uses those saved copies; review them before running it.');
        } catch (error) {
          if (!(error instanceof GenerationCancelledError)) throw error;
          void vscode.window.showInformationMessage('The runtime app was generated. Only portal data export was cancelled; existing exported data was preserved.');
        }
      } catch (error) {
        await showCommandError(error, {
          fallbackMessage: 'Failed to generate FM Web Next.js runtime template.',
          logger,
          logMessage: 'Generate FM Web Next.js runtime template command failed.'
        });
      }
    }),

    vscode.commands.registerCommand('filemakerDataApiTools.generateFmWebLayoutPage', async (arg: unknown) => {
      if (!vscode.workspace.isTrusted) {
        vscode.window.showWarningMessage(
          'Workspace trust is required to generate FM Web layout runtime artifacts.'
        );
        return;
      }

      try {
        const layouts = await fmWebRuntimeGenerator.listLayoutDefinitions();
        if (layouts.length === 0) {
          vscode.window.showWarningMessage('No layout definitions were found. Save a layout first.');
          return;
        }

        const selectedId =
          extractLayoutIdArg(arg) ??
          (await vscode.window.showQuickPick(
            layouts.map((layout) => ({
              label: layout.name,
              description: layout.id,
              id: layout.id
            })),
            {
              title: 'Generate Runtime Layout Artifact',
              placeHolder: 'Choose a layout to generate'
            }
          ))?.id;

        if (!selectedId) {
          return;
        }

        const generated = await fmWebRuntimeGenerator.generateLayoutPage(selectedId);
        vscode.window.showInformationMessage(
          `Generated layout artifact for "${generated.name}" at .fmweb/generated/layouts/${generated.id}.layout.json.`
        );
      } catch (error) {
        await showCommandError(error, {
          fallbackMessage: 'Failed to generate FM Web layout runtime artifact.',
          logger,
          logMessage: 'Generate FM Web layout runtime artifact command failed.'
        });
      }
    }),

    vscode.commands.registerCommand('filemakerDataApiTools.startFmWebPreviewServer', async (arg: unknown) => {
      if (!vscode.workspace.isTrusted) {
        vscode.window.showWarningMessage(
          'Workspace trust is required to start FM Web preview services.'
        );
        return;
      }

      if (previewStarting) return;
      previewStarting = true;
      try {
        await preview?.dispose().catch(() => {
          void vscode.window.showWarningMessage('Could not stop the previous preview process tree. Its temporary-file cleanup was attempted; starting a new preview.');
        });
        preview = undefined;
        await fmBridgeServer.stop();
        const ignored = await fmWebRuntimeGenerator.inspectPreviewFiles();
        const listing = ignored.map((file) => displayText(file, Infinity)).join('\n');
        if (listing.length > 12000) throw new Error('Too many ignored runtime files to show safely in the preview confirmation.');
        const portalFiles = await intakes.previewFiles();
        const layouts = new Map<string, Buffer>();
        const skippedLayouts: string[] = [];
        for (const layout of await fmWebRuntimeGenerator.listLayoutDefinitions()) {
          try {
            const generated = await fmWebRuntimeGenerator.generateLayoutPage(layout.id);
            layouts.set(path.basename(generated.outputPath), await readFile(generated.outputPath));
          } catch (error) {
            if (!(error instanceof GenerationSkippedError)) throw error;
            skippedLayouts.push(displayText(layout.name, Infinity));
          }
        }
        if (skippedLayouts.length) void vscode.window.showWarningMessage(`These layouts were skipped in the preview because their generated files were edited or are symbolic links: ${skippedLayouts.join(', ')}. Your files were left untouched.`);
        const runtimeRoot = fmWebRuntimeGenerator.getGeneratedRuntimeRoot();
        const templateFiles = await fmWebRuntimeGenerator.previewTemplateFiles();
        const real = arg && typeof arg === 'object' && 'registrationMode' in arg && arg.registrationMode === 'filemaker';
        const requestedIntake = arg && typeof arg === 'object' && 'intakeId' in arg ? arg.intakeId : undefined;
        const project = await fmWebProjectService.readProjectConfig();
        const profileId = project?.activeProfileId ?? profileStore.getActiveProfileId();
        const storedProfile = profileId ? await profileStore.getProfile(profileId) : undefined;
        const profile = storedProfile ? structuredClone(storedProfile) : undefined;
        const workspaceRoot = real ? fmWebProjectService.getWorkspaceRoot() : undefined;
        let registration: { definition: ReturnType<typeof intakeDefinitionSchema.parse>; layout: ReturnType<typeof layoutDefinitionSchema.parse> } | undefined;
        if (real) {
          if (!profile || !context.globalStorageUri?.fsPath || !workspaceRoot) throw new Error('Choose FileMaker fields and a saved connection before enabling FileMaker saves.');
          if (typeof requestedIntake !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(requestedIntake)) throw new Error('Choose an existing app.');
          const raw = portalFiles.intakes.get(`${requestedIntake}.intake.json`);
          if (!raw) throw new Error('Choose an existing app.');
          const definition = intakeDefinitionSchema.parse(JSON.parse(raw.toString('utf8')));
          const source = portalFiles.layouts.get(`${definition.layoutId}.layout.json`);
          if (!source) throw new Error('The source layout is missing.');
          const layout = layoutDefinitionSchema.parse(JSON.parse(source.toString('utf8')));
          if (!layout.fmLayoutName) throw new Error('Choose a FileMaker layout before enabling saves.');
          const metadata = await fmClient.getLayoutMetadata(profile, layout.fmLayoutName, { recordHistory: false });
          const writable = new Set(writableAppFields(designerLayoutMetadata(layout.fmLayoutName, metadata).fields).map((field) => field.name));
          if (definition.fields.some((field) => !writable.has(field.fmFieldName))) throw new Error('The form contains fields that are missing, global or read-only on this connection. Choose FileMaker fields again.');
          const refusal = bridgeRouteRefusal('/submitRegistration', vscode.workspace.getConfiguration('filemaker'), roleGuard);
          if (refusal) throw new Error(refusal);
          registration = { definition, layout };
        }
        const fieldNames = registration?.definition.fields.map((field) => displayText(field.fmFieldName, Infinity)).join(', ');
        if (fieldNames && fieldNames.length > 12000) throw new Error('Choose fewer fields so the FileMaker save approval can show every exact field name.');
        const connectionHost = registration && profile ? displayText(new URL(profile.authMode === 'proxy' ? profile.proxyEndpoint ?? profile.serverUrl : profile.serverUrl).host, Infinity) : '';
        const runLabel = real ? 'Enable FileMaker saves' : 'Run';
        const destination = registration && profile ? `\n\nREAL FILEMAKER SAVES: Submitting this form will create records.\nConnection: ${displayText(profile.name, Infinity)}\nServer host: ${connectionHost}\nDatabase: ${displayText(profile.database, Infinity)}\nLayout: ${displayText(registration.layout.fmLayoutName!, Infinity)}\nFields (${registration.definition.fields.length}): ${fieldNames}.\nDuplicate protection persists across restarts; uncertain writes must be checked in FileMaker before a new submission.` : '';
        const answer = await vscode.window.showWarningMessage(
          `Start the FM Web preview?${destination}\n\nA fresh private temporary copy of the shipped template will run these commands:\n${previewInstallDescription(templateFiles)}\n${PREVIEW_DEV_DESCRIPTION}\n\nThe npm command uses pinned empty --userconfig and --globalconfig files, an explicit --prefix and private cache, and a cleared configuration environment. The template's preview server runs Next on 127.0.0.1:3000 and checks the private session before every request, hot reload included. Dependencies named in the template package.json are downloaded from registry.npmjs.org. No install scripts run.\n\nThe runtime checked was:\n${displayText(runtimeRoot, Infinity)}\n\nWorkspace npm configuration and .env overrides are ignored. Your runtime files are left untouched.${ignored.length ? `\nThese edited or added files are ignored in the private preview:\n${listing}` : ''}\n\nThe extension opens your browser with a one-time private launch link.`,
          { modal: true }, runLabel
        );
        if (answer !== runLabel) { await fmWebRuntimeGenerator.clearBridgeEnv(); return; }
        const bridge = await fmBridgeServer.ensureStarted();
        const token = fmBridgeServer.getSessionToken();
        if (!token) throw new Error('Bridge session is not ready.');
        if (registration && profile) {
          const binding = stableRecordStringify(profile as unknown as Record<string, unknown>);
          const service = new FmWebRegistrationService({ ...registration, profile, ledgerRoot: path.join(context.globalStorageUri.fsPath, 'registration-receipts'),
            createRecord: fmClient.createRecord.bind(fmClient),
            assertAllowed: async () => {
              const currentProject = await fmWebProjectService.readProjectConfig();
              const currentProfile = await profileStore.getProfile(profile.id);
              const refusal = bridgeRouteRefusal('/submitRegistration', vscode.workspace.getConfiguration('filemaker'), roleGuard);
              if (!vscode.workspace.isTrusted || fmWebProjectService.getWorkspaceRoot() !== workspaceRoot || fmBridgeServer.getSessionToken() !== token
                || (currentProject?.activeProfileId ?? profileStore.getActiveProfileId()) !== profile.id || !currentProfile
                || stableRecordStringify(currentProfile as unknown as Record<string, unknown>) !== binding || refusal) throw new Error('The approved connection, workspace, session or write policy changed. Start Save to FileMaker again.');
            } });
          fmBridgeServer.setRegistrationHandler((payload) => service.submit(payload));
        }
        preview = new FmWebPreviewProcess();
        const intakeId = arg && typeof arg === 'object' && 'intakeId' in arg ? arg.intakeId : undefined;
        if (intakeId !== undefined && (typeof intakeId !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(intakeId) || !portalFiles.intakes.has(`${intakeId}.intake.json`))) throw new Error('Choose an existing app to preview.');
        const previewArgs = [templateFiles, layouts, bridge.baseUrl, token, profile?.serverUrl, portalFiles.intakes, portalFiles.layouts] as const;
        if (real && typeof intakeId === 'string') await preview.start(...previewArgs, intakeId, 'filemaker');
        else if (typeof intakeId === 'string') await preview.start(...previewArgs, intakeId);
        else await preview.start(...previewArgs);
        vscode.window.showInformationMessage('FM Web preview is ready in your browser. Restarting it invalidates the previous launch and session.');
      } catch (error) {
        await preview?.dispose().catch(() => logger.warn('Could not stop the private preview or finish its temporary-file cleanup.'));
        preview = undefined;
        await fmBridgeServer.stop();
        await showCommandError(error, {
          fallbackMessage: 'Failed to start FM Web preview server.',
          logger,
          logMessage: 'Start FM Web preview server command failed.'
        });
      } finally {
        previewStarting = false;
      }
    })
  ];
}

/** Explain why explicit generation preserved edited managed files. */
function warnAboutEditedManagedFiles(files: string[] | undefined): void {
  if (!files || files.length === 0) {
    return;
  }
  void vscode.window.showWarningMessage(
    `These generated preview files were edited (or are symbolic links), so they were not updated: ${files.join(', ')}. Preview uses a clean temporary copy. Your edits remain available for manual use.`
  );
}

function extractLayoutIdArg(arg: unknown): string | undefined {
  if (!arg || typeof arg !== 'object' || Array.isArray(arg)) {
    return undefined;
  }

  const raw = (arg as Record<string, unknown>).layoutId;
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : undefined;
}
