import * as vscode from 'vscode';

import type * as vscodeTypes from 'vscode';

import { FileMakerHomePanel } from '../webviews/home';

export interface RegisterHomeCommandsDeps {
  context: vscodeTypes.ExtensionContext;
}

/** The FileMaker home: one panel that leads to the four journeys and to the advanced tools. */
export function registerHomeCommands(deps: RegisterHomeCommandsDeps): vscode.Disposable[] {
  return [
    vscode.commands.registerCommand('filemakerDataApiTools.startHere', async () => {
      FileMakerHomePanel.createOrShow(deps.context);
    })
  ];
}
