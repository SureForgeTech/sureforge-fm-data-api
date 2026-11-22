import { lstat } from 'fs/promises';
import { safeFileName } from '../utils/safeText';
import { displayText } from '../ai/aiText';
import * as vscode from 'vscode';
import { singleFlight } from '../utils/singleFlight';

import type { RoleGuard } from '../enterprise/roleGuard';
import type { BatchService } from '../services/batchService';
import type { BatchUpdateInputFormat } from '../services/batchService';
import { isProxyProfile } from '../types/fm';
import type { BatchUpdateEntry } from '../types/fm';
import type { JobRunner } from '../services/jobRunner';
import type { FMClient } from '../services/fmClient';
import type { Logger } from '../services/logger';
import type { ProfileStore } from '../services/profileStore';
import type { SettingsService } from '../services/settingsService';
import { nulTextFields } from '../utils/nulText';
import { dateFormatLabel } from '../utils/dateFormat';
import { parseFindJson, parseSortJson } from '../utils/jsonValidate';
import {
  parseLayoutArg,
  promptForLayout,
  resolveProfileFromArg,
  showCommandError
} from './common';

interface RegisterBatchCommandsDeps {
  profileStore: ProfileStore;
  fmClient: FMClient;
  batchService: BatchService;
  jobRunner: JobRunner;
  roleGuard: RoleGuard;
  settingsService: SettingsService;
  logger: Logger;
}

export function registerBatchCommands(deps: RegisterBatchCommandsDeps): vscode.Disposable[] {
  const { profileStore, fmClient, batchService, jobRunner, roleGuard, settingsService, logger } = deps;

  return [
    vscode.commands.registerCommand('filemakerDataApiTools.batchExportFind', singleFlight(async (arg: unknown) => {
      if (!(await ensureBatchEnabled(settingsService))) {
        return;
      }

      const contextArg = parseLayoutArg(arg);
      const profile = await resolveProfileFromArg(contextArg, profileStore, true);
      if (!profile) {
        return;
      }

      const layout = contextArg.layout ?? (await promptForLayout(profile, fmClient));
      if (!layout) {
        return;
      }

      const findJsonInput = await vscode.window.showInputBox({
        title: 'Batch Export (Find)',
        prompt: 'Find query JSON array',
        value: '[{}]',
        ignoreFocusOut: true
      });
      if (!findJsonInput) {
        return;
      }

      const sortJsonInput = await vscode.window.showInputBox({
        title: 'Batch Export (Find)',
        prompt: 'Sort JSON array (optional)',
        ignoreFocusOut: true
      });

      const outputUri = await vscode.window.showSaveDialog({
        title: 'Export batch find results',
        defaultUri: vscode.Uri.file(`${safeFileName(layout)}.jsonl`),
        filters: {
          JSONL: ['jsonl'],
          CSV: ['csv']
        }
      });
      if (!outputUri) {
        return;
      }

      const findValidation = parseFindJson(findJsonInput);
      if (!findValidation.ok || !findValidation.value) {
        vscode.window.showErrorMessage(findValidation.error ?? 'Invalid find JSON.');
        return;
      }
      const findQuery = findValidation.value;

      let sort: Array<Record<string, unknown>> | undefined;
      if (sortJsonInput && sortJsonInput.trim().length > 0) {
        const sortValidation = parseSortJson(sortJsonInput);
        if (!sortValidation.ok || !sortValidation.value) {
          vscode.window.showErrorMessage(sortValidation.error ?? 'Invalid sort JSON.');
          return;
        }

        sort = sortValidation.value;
      }

      const maxRecords = settingsService.getBatchMaxRecords();

      const performanceMode = roleGuard.resolvePerformanceMode();
      const { inferExportFormat } = await import('../services/batchService');
      const selectedFormat = inferExportFormat(outputUri.fsPath);
      const format = performanceMode === 'high-scale' ? 'jsonl' : selectedFormat;
      const outputPath =
        performanceMode === 'high-scale' && selectedFormat !== 'jsonl'
          ? replaceExtension(outputUri.fsPath, '.jsonl')
          : outputUri.fsPath;

      if (outputPath !== outputUri.fsPath) {
        try {
          await lstat(outputPath);
          const answer = await vscode.window.showWarningMessage(
            `High-scale export uses ${displayText(outputPath)}. This file already exists. Replace it?`,
            { modal: true }, 'Overwrite'
          );
          if (answer !== 'Overwrite') return;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            vscode.window.showErrorMessage('Could not check the JSONL export destination. Export cancelled.');
            return;
          }
        }
      }

      const csvChoice = format === 'csv'
        ? await vscode.window.showQuickPick(['Standard CSV', 'Excel-compatible CSV (UTF-8 BOM)'], { title: 'CSV format' })
        : 'Standard CSV';
      if (!csvChoice) return;

      const job = jobRunner.startJob(`Batch Export ${layout}`, async (jobContext) => {
        jobContext.log('info', `Starting export to ${outputPath}`);

        const result = await batchService.batchExportFind(
          profile,
          layout,
          {
            query: findQuery,
            sort
          },
          {
            outputPath,
            excelCompatible: csvChoice.startsWith('Excel'),
            format,
            maxRecords
          },
          jobContext
        );

        if (result.cancelled) return result;
        if (result.unknownColumnValues) {
          void vscode.window.showWarningMessage(`${result.unknownColumnValues} values were not exported because their columns were unknown. See the export job for column names.`);
        }
        jobContext.log(
          'info',
          `Finished export. Records=${result.exportedRecords}, truncated=${result.truncated}`
        );
        return result;
      });

      vscode.window.showInformationMessage(`Started job ${job.id.slice(0, 8)} for batch export.`);
    })),

    vscode.commands.registerCommand(
      'filemakerDataApiTools.batchUpdateFromFile',
      singleFlight(async (arg: unknown) => {
        if (!(await ensureBatchEnabled(settingsService))) {
          return;
        }

        const contextArg = parseLayoutArg(arg);
        const profile = await resolveProfileFromArg(contextArg, profileStore, true);
        if (!profile) {
          return;
        }

        const layout = contextArg.layout ?? (await promptForLayout(profile, fmClient));
        if (!layout) {
          return;
        }

        const filePick = await vscode.window.showOpenDialog({
          title: 'Batch update source file',
          canSelectMany: false,
          filters: {
            JSON: ['json'],
            CSV: ['csv']
          }
        });

        const sourceUri = filePick?.[0];
        if (!sourceUri) {
          return;
        }

        try {
          const sourceBytes = await vscode.workspace.fs.readFile(sourceUri);
          const sourceText = Buffer.from(sourceBytes).toString('utf8');
          const format = sourceUri.fsPath.toLowerCase().endsWith('.csv') ? 'csv' : 'json';
          const { parseBatchUpdateInput, BatchUpdateFormatRefusal } = await import(
            '../services/batchService'
          );
          let entries: BatchUpdateEntry[];
          try {
            entries = parseBatchUpdateInput(sourceText, format);
          } catch (error) {
            // The file is a shape the extension does not read on its own: one record per line, or
            // a spreadsheet's semicolons. The developer says which one it is.
            if (!(error instanceof BatchUpdateFormatRefusal)) throw error;
            const alternative = error.alternative;
            const choice = await vscode.window.showQuickPick(
              [
                {
                  label:
                    alternative === 'jsonl'
                      ? 'Import it as JSONL (one record per line)'
                      : 'Import it as a semicolon-delimited CSV',
                  value: alternative
                },
                { label: 'Cancel', value: 'cancel' }
              ] as Array<{ label: string; value: BatchUpdateInputFormat | 'cancel' }>,
              { title: error.message, placeHolder: 'The extension does not guess this shape.' }
            );
            if (!choice || choice.value === 'cancel') {
              vscode.window.showWarningMessage('Batch update cancelled: the file was not read.');
              return;
            }
            entries = parseBatchUpdateInput(sourceText, choice.value);
          }
          if (entries.length === 0) {
            vscode.window.showWarningMessage('No valid update rows found.');
            return;
          }

          const maxRecords = settingsService.getBatchMaxRecords();
          if (entries.length > maxRecords) {
            vscode.window.showWarningMessage(`Batch update refused: ${entries.length} rows exceed filemaker.batch.maxRecords (${maxRecords}). Split the file or raise the setting before retrying.`);
            return;
          }

          const defaults = await batchService.getDefaultBatchUpdateOptions();
          // The dates in the file are read the way the developer chose, so the mode picker says
          // which order that is beside the choice itself. A proxy connection is answered by the
          // proxy, so the setting does not apply there and the order is the proxy's own.
          const dateFormat = settingsService.getDateFormats();
          const dateOrder = isProxyProfile(profile)
            ? { dateFormatLabel: "the proxy's own order" }
            : { dateFormat, dateFormatLabel: dateFormatLabel(dateFormat) };
          const dryRunSelection = await vscode.window.showQuickPick(
            [
              { label: 'Dry-run only (recommended)', value: true },
              { label: 'Execute updates now', value: false }
            ],
            {
              title: 'Batch Update Mode',
              placeHolder: `Default: ${defaults.dryRun ? 'dry-run' : 'execute'} · Dates: ${dateOrder.dateFormatLabel}`
            }
          );

          if (!dryRunSelection) {
            return;
          }

          let overwriteChanged: boolean | undefined;
          const rowsWithModId = entries.filter((entry) => entry.modId !== undefined).length;
          if (!dryRunSelection.value) {
            if (!settingsService.isRecordEditEnabled()) {
              vscode.window.showInformationMessage('Record editing is disabled by settings. Batch update is unavailable.');
              return;
            }
            if (
              !(await roleGuard.assertFeature('batchUpdate', 'Batch update from CSV/JSON')) ||
              !(await roleGuard.assertFeature('recordEdit', 'Batch update from CSV/JSON')) ||
              !(await roleGuard.assertFeature('writeOperations', 'Batch update from CSV/JSON'))
            ) {
              return;
            }
            let server = profile.serverUrl;
            try { server = new URL(server).host; } catch { /* Keep the supplied address when it is not a URL. */ }
            const confirmation = await vscode.window.showWarningMessage(
              `Execute batch update for ${entries.length} records on ${displayText(layout)}? Profile ${displayText(profile.name)}, server ${displayText(server)}.\nRollback guidance: keep a pre-update export and rerun updates with previous values to revert.`,
              { modal: true },
              'Execute'
            );

            if (confirmation !== 'Execute') return;
            if (rowsWithModId === 0) {
              const choice = await vscode.window.showWarningMessage(
                'This file has no modId column, so updates cannot detect newer changes. Continue without the check?',
                { modal: true }, 'Continue'
              );
              if (choice !== 'Continue') return;
            } else {
              const choice = await vscode.window.showWarningMessage(
                `Check for newer changes before updating? ${rowsWithModId} rows have modId; ${entries.length - rowsWithModId} rows have no modId and cannot be checked.`,
                { modal: true }, 'Check for newer changes (recommended)', 'Overwrite even if changed'
              );
              if (choice !== 'Check for newer changes (recommended)' && choice !== 'Overwrite even if changed') return;
              overwriteChanged = choice === 'Overwrite even if changed';
            }
          }

          const concurrency = settingsService.getBatchConcurrency();

          const job = jobRunner.startJob(`Batch Update ${layout}`, async (jobContext) => {
            jobContext.log(
              'info',
              `Starting batch update from ${sourceUri.fsPath} (dryRun=${dryRunSelection.value})`
            );

            const result = await batchService.batchUpdate(
              profile,
              layout,
              entries,
              {
                dryRun: dryRunSelection.value,
                concurrency,
                ...(overwriteChanged !== undefined ? { overwriteChanged } : {})
              },
              jobContext
            );

            jobContext.log(
              'info',
              `Batch update completed. Attempted=${result.attempted}, success=${result.successCount}, failures=${result.failureCount}${result.skippedReadOnlyRows ? `. ${result.skippedReadOnlyRows} rows had no editable values and were skipped` : ''}${result.skippedChanged ? `. ${result.skippedChanged} rows were skipped because the records changed after the export` : ''}${result.stoppedReason ? `. Stopped early (${result.notAttempted ?? 0} not attempted): ${result.stoppedReason}` : ''}`
            );

            if (dryRunSelection.value) {
              const previewEntries = entries.map((entry) => ({ ...entry, fieldData: Object.fromEntries(
                Object.entries(entry.fieldData).filter(([name]) => !result.skippedColumns?.includes(name))
              ) }));
              const preview = {
                dryRun: true,
                totalEntries: entries.length,
                layout,
                // The dates in the file are read in the order the developer chose, so the preview
                // says which order that is.
                ...dateOrder,
                rowsWithModId: result.rowsWithModId ?? rowsWithModId,
                rowsChecked: result.rowsChecked ?? rowsWithModId,
                skippedColumns: result.skippedColumns ?? [],
                warnings: result.warnings ?? [],
                sample: previewEntries.slice(0, 5),
                // Rows are numbered from 1 in the parsed data, excluding a CSV header.
                flaggedRows: previewEntries.flatMap((entry, index) => {
                  const fields = nulTextFields(entry.fieldData);
                  return fields.length ? [{ row: index + 1, recordId: entry.recordId, fields }] : [];
                })
              };
              try {
                const document = await vscode.workspace.openTextDocument({ language: 'json', content: JSON.stringify(preview, null, 2) });
                await vscode.window.showTextDocument(document, { preview: false, preserveFocus: true });
              } catch {
                jobContext.log('warn', 'The dry-run preview could not be opened. The result and warnings are still available in Jobs.');
              }
            }

            return result;
          });

          vscode.window.showInformationMessage(`Started job ${job.id.slice(0, 8)} for batch update.`);

        } catch (error) {
          await showCommandError(error, {
            fallbackMessage: 'Batch update failed to start.',
            logger,
            logMessage: 'Batch update failed to start.'
          });
        }
      })
    )
  ];
}

async function ensureBatchEnabled(settingsService: SettingsService): Promise<boolean> {
  const enabled = settingsService.isBatchEnabled();
  if (!enabled || !vscode.workspace.isTrusted) {
    void vscode.window
      .showInformationMessage(
        'Batch operations are disabled in settings or untrusted workspace mode.',
        'Learn More'
      )
      .then((selection) => {
        if (selection === 'Learn More') {
          void vscode.env.openExternal(
            vscode.Uri.parse('https://code.visualstudio.com/docs/editor/workspace-trust')
          );
        }
      });
    return false;
  }

  return true;
}

function replaceExtension(path: string, extension: string): string {
  if (path.toLowerCase().endsWith(extension.toLowerCase())) {
    return path;
  }

  const withoutExt = path.replace(/\.[A-Za-z0-9]+$/, '');
  return `${withoutExt}${extension}`;
}
