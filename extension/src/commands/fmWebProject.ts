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
import { GenerationSkippedError } from '../services/generatedFileWriter';
import type { Logger } from '../services/logger';
import type { ProfileStore } from '../services/profileStore';
import type { SchemaService } from '../services/schemaService';
import type { RoleGuard } from '../enterprise/roleGuard';
import { LayoutModePanel } from '../webviews/layoutMode';
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
  context.subscriptions?.push({ dispose: () => { void preview?.dispose().catch(() => undefined); } });

  return [
    vscode.commands.registerCommand('filemakerDataApiTools.buildPortal', async () => {
      if (!vscode.workspace.isTrusted) {
        void vscode.window.showWarningMessage('Workspace trust is required to build a portal.'); return;
      }
      try {
        const action = await vscode.window.showQuickPick([
          { label: 'Create or resume event registration', action: 'create', description: 'Sample data; no connection needed' },
          { label: 'Edit form and exact field mappings', action: 'edit', description: 'Title, labels, help, required fields and branding' },
          { label: 'Preview saved portal', action: 'preview', description: 'Validate definitions, then start the private sample preview' },
          { label: 'Export app scaffold', action: 'export', description: 'Generate the runtime with saved forms and layouts; preserves edits' },
          { label: 'Open source layout', action: 'layout', description: 'Continue in the existing Layout Mode designer' }
        ], { title: 'Build a Portal', placeHolder: 'Create → edit → preview → submit with invented details' });
        if (!action) return;
        const saved = action.action === 'create' ? await intakes.ensureEventStarter() : await intakes.load('event-registration');
        if (action.action === 'layout') {
          await vscode.commands.executeCommand('filemakerDataApiTools.openLayoutMode', { layoutId: saved.layout.id });
        } else if (action.action === 'export') {
          await vscode.commands.executeCommand('filemakerDataApiTools.generateFmWebNextApp');
        } else if (action.action === 'preview') {
          await vscode.commands.executeCommand('filemakerDataApiTools.startFmWebPreviewServer');
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
        const skippedPortalFiles = await intakes.exportSnapshot(portalFiles);
        if (skippedPortalFiles.length) void vscode.window.showWarningMessage('Some existing portal data files were preserved. The exported app uses those saved copies; review them before running it.');
        vscode.window.showInformationMessage(
          `Generated Next.js runtime template in .fmweb/generated/runtime-next (${summary.created.length} created, ${summary.updated.length} updated, ${summary.skipped.length} skipped).`
        );
        warnAboutEditedManagedFiles(summary.needsManualUpdate);
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

    vscode.commands.registerCommand('filemakerDataApiTools.startFmWebPreviewServer', async () => {
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
        const layouts = new Map<string, Buffer>(portalFiles.layouts);
        const skippedLayouts: string[] = [];
        for (const layout of await fmWebRuntimeGenerator.listLayoutDefinitions()) {
          if (layouts.has(`${layout.id}.layout.json`)) continue;
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
        const answer = await vscode.window.showWarningMessage(
          `Start the FM Web preview?\n\nA fresh private temporary copy of the shipped template will run these commands:\n${previewInstallDescription(templateFiles)}\n${PREVIEW_DEV_DESCRIPTION}\n\nThe npm command uses pinned empty --userconfig and --globalconfig files, an explicit --prefix and private cache, and a cleared configuration environment. The template's preview server runs Next on 127.0.0.1:3000 and checks the private session before every request, hot reload included. Dependencies named in the template package.json are downloaded from registry.npmjs.org. No install scripts run.\n\nThe runtime checked was:\n${displayText(runtimeRoot, Infinity)}\n\nWorkspace npm configuration and .env overrides are ignored. Your runtime files are left untouched.${ignored.length ? `\nThese edited or added files are ignored in the private preview:\n${listing}` : ''}\n\nThe extension opens your browser with a one-time private launch link.`,
          { modal: true }, 'Run'
        );
        if (answer !== 'Run') { await fmWebRuntimeGenerator.clearBridgeEnv(); return; }
        const bridge = await fmBridgeServer.ensureStarted();
        const token = fmBridgeServer.getSessionToken();
        if (!token) throw new Error('Bridge session is not ready.');
        const project = await fmWebProjectService.readProjectConfig();
        const profileId = project?.activeProfileId ?? profileStore.getActiveProfileId();
        const profile = profileId ? await profileStore.getProfile(profileId) : undefined;
        preview = new FmWebPreviewProcess();
        await preview.start(templateFiles, layouts, bridge.baseUrl, token, profile?.serverUrl, portalFiles.intakes);
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
