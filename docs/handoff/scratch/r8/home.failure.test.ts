/**
 * Independent reviewer scratch check, part 4 for PR #579:
 *  what the home does when the command it runs rejects.
 */
import { writeFileSync } from 'node:fs';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';

import { FileMakerHomePanel } from '/workspace/sureforge-fm-data-api-wt-home/extension/src/webviews/home';

const log: string[] = [];
const note = (line: string): void => {
  log.push(line);
  writeFileSync('/workspace/.fm-scratch/r8/result4.txt', log.join('\n') + '\n');
};

let dispose: (() => void) | undefined;
let receive: ((message: unknown) => void) | undefined;
const panel = {
  webview: {
    html: '',
    cspSource: 'vscode-resource:',
    asWebviewUri: (uri: unknown) => String(uri),
    onDidReceiveMessage: (listener: (message: unknown) => void) => {
      receive = listener;
    },
    postMessage: vi.fn(async () => true)
  },
  reveal: vi.fn(),
  onDidDispose: (listener: () => void) => {
    dispose = listener;
  },
  dispose: vi.fn(() => dispose?.())
};
const context = { extensionUri: { fsPath: '/extension' }, subscriptions: [] } as unknown as vscode.ExtensionContext;

beforeEach(() => {
  vi.clearAllMocks();
  dispose = undefined;
  receive = undefined;
});

afterEach(() => {
  dispose?.();
});

describe('a command that rejects', () => {
  it('is not caught by the home: nothing is shown to the user', async () => {
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown): void => {
      rejections.push(reason);
    };
    process.on('unhandledRejection', onRejection);

    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as never);
    FileMakerHomePanel.createOrShow(context);

    vi.mocked(vscode.commands.executeCommand).mockRejectedValue(new Error('command blew up'));
    receive!({ type: 'run', command: 'filemakerDataApiTools.createFmWebApp' });
    await new Promise((resolve) => setTimeout(resolve, 50));

    note(`I1 error messages shown to the user: ${vi.mocked(vscode.window.showErrorMessage).mock.calls.length}`);
    note(`I2 information messages shown to the user: ${vi.mocked(vscode.window.showInformationMessage).mock.calls.length}`);
    note(`I3 warning messages shown to the user: ${vi.mocked(vscode.window.showWarningMessage).mock.calls.length}`);
    note(`I4 unhandled rejections observed: ${rejections.length}${rejections.length ? ` -> ${String(rejections[0])}` : ''}`);
    expect(rejections.length).toBe(1);
    expect(vi.mocked(vscode.window.showErrorMessage)).not.toHaveBeenCalled();

    process.off('unhandledRejection', onRejection);
  });
});
