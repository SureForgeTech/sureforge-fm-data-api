import { writeFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const REPO = '/workspace/sureforge-fm-data-api-wt-home';

describe('home message allowlist, independently', () => {
  it('runs only catalogue commands and never passes arguments', async () => {
    const vscode = await import('vscode');
    const { FileMakerHomePanel } = await import(`${REPO}/extension/src/webviews/home/index.ts`);
    const { FILEMAKER_HOME_COMMANDS } = await import(`${REPO}/extension/src/webviews/home/catalogue.ts`);

    let receive: (message: unknown) => void = () => undefined;
    let dispose: () => void = () => undefined;
    (vscode as any).window.createWebviewPanel.mockImplementation(() => ({
      webview: {
        html: '',
        cspSource: 'vscode-resource:',
        asWebviewUri: (uri: unknown) => String(uri),
        onDidReceiveMessage: (listener: (message: unknown) => void) => {
          receive = listener;
        },
        postMessage: async () => true
      },
      reveal: vi.fn(),
      onDidDispose: (listener: () => void) => {
        dispose = listener;
      },
      dispose: vi.fn()
    }));

    FileMakerHomePanel.createOrShow({ extensionUri: { fsPath: '/extension' } } as never);

    const hostile: unknown[] = [
      { type: 'run', command: 'workbench.action.terminal.new' },
      { type: 'run', command: ['filemakerDataApiTools.connect'] },
      { type: 'run', command: { toString: () => 'filemakerDataApiTools.connect' } },
      { type: 'run', command: 'constructor' },
      { type: 'run', command: '__proto__' },
      { type: 'run', command: 'toString' },
      { type: 'run', command: 'filemakerDataApiTools.connect ' },
      { type: 'run', command: 'filemakerDataApiTools.connect\n' },
      { type: 'run', command: 'filemakerDataApiTools.connect; rm -rf /' },
      { type: 'run', command: '' },
      { type: 'run' },
      { type: 'RUN', command: 'filemakerDataApiTools.connect' },
      { type: 'execute', command: 'filemakerDataApiTools.connect' },
      { command: 'filemakerDataApiTools.connect' },
      'run',
      null,
      undefined,
      42,
      ['run', 'filemakerDataApiTools.connect'],
      { type: 'run', command: 'vscode.executeDefinitionProvider' },
      { type: 'run', command: 'filemakerDataApiTools.startHere' }
    ];

    for (const message of hostile) {
      await receive(message);
    }
    const calls = vi.mocked(vscode.commands.executeCommand).mock.calls;
    const summary = {
      catalogueCount: FILEMAKER_HOME_COMMANDS.length,
      allCatalogueIdsAreExtensionCommands: FILEMAKER_HOME_COMMANDS.every((id) => id.startsWith('filemakerDataApiTools.')),
      duplicateCatalogueIds: FILEMAKER_HOME_COMMANDS.length !== new Set(FILEMAKER_HOME_COMMANDS).size,
      executeCommandCallsAfterHostileMessages: calls.map((call) => call)
    };
    writeFileSync('/workspace/.fm-scratch/r9/allowlist-result.json', JSON.stringify(summary, null, 2));

    // None of the hostile messages may reach executeCommand.
    expect(calls.length).toBe(0);

    // A legitimate catalogue command runs, with the command id as the only argument:
    // any extra field the page sends is ignored.
    await receive({ type: 'run', command: 'filemakerDataApiTools.connect', args: ['--evil'], extra: 1 });
    expect(vi.mocked(vscode.commands.executeCommand).mock.calls).toEqual([['filemakerDataApiTools.connect']]);

    dispose();
  });
});
