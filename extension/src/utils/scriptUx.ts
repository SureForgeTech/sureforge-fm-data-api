import * as vscode from 'vscode';

import { describeScriptErrors } from '../services/responseGuard';
import type { FileMakerRecord, LoadedRecord, ScriptErrorReport } from '../types/fm';

/**
 * A script that ran with a record read reported an error. The read itself worked, so this is a
 * warning beside the record and never an error.
 */
export function warnAboutRecordScriptErrors(scriptErrors: ScriptErrorReport[] | undefined): void {
  if (scriptErrors && scriptErrors.length > 0) {
    void vscode.window.showWarningMessage(`The record loaded, but ${describeScriptErrors(scriptErrors)}.`);
  }
}

/**
 * The FileMaker record on its own. The script errors travel beside the record in a warning, so
 * they do not belong to the record a page shows or exports.
 */
export function recordWithoutScriptErrors(record: LoadedRecord): FileMakerRecord {
  const copy: LoadedRecord = { ...record };
  delete copy.scriptErrors;
  return copy;
}
