/**
 * Independent reviewer scratch checks, part 3 for PR #579:
 *  - the contributed `FileMaker: Start Here` command really opens the home panel
 *  - every catalogue command is registered even in an untrusted workspace
 *  - every catalogue command's handler takes no required argument (the home calls it with none)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';

import { FILEMAKER_HOME_COMMANDS } from '/workspace/sureforge-fm-data-api-wt-home/extension/src/webviews/home/catalogue';

const EXT = '/workspace/sureforge-fm-data-api-wt-home/extension';

const log: string[] = [];
const note = (line: string): void => {
  log.push(line);
  writeFileSync('/workspace/.fm-scratch/r8/result3.txt', log.join('\n') + '\n');
};

vi.mock('/workspace/sureforge-fm-data-api-wt-home/extension/src/services/fmWebProjectService', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const Base = actual.FmWebProjectService as new (...args: unknown[]) => { readProjectConfig: () => Promise<undefined> };
  return {
    ...actual,
    FmWebProjectService: class extends Base {
      public override async readProjectConfig(): Promise<undefined> {
        return undefined;
      }
    }
  };
});

vi.mock('/workspace/sureforge-fm-data-api-wt-home/extension/src/services/schemaSnapshotStore', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const Base = actual.SchemaSnapshotStore as new (...args: unknown[]) => { listSnapshots: () => Promise<unknown[]> };
  return {
    ...actual,
    SchemaSnapshotStore: class extends Base {
      public override async listSnapshots(): Promise<unknown[]> {
        return [];
      }
    }
  };
});

describe('the contributed command opens the home, and every catalogue command is reachable', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    installActivationMocks();
  });

  it('FileMaker: Start Here opens the filemakerHome panel', async () => {
    const ctx = createActivationContext();
    const { activate } = await import('/workspace/sureforge-fm-data-api-wt-home/extension/src/extension');
    await activate(ctx);

    const registered = vi.mocked(vscode.commands.registerCommand).mock.calls;
    const startHere = registered.find(([id]) => id === 'filemakerDataApiTools.startHere');
    note(`H1 startHere registered: ${Boolean(startHere)}`);
    expect(startHere).toBeDefined();

    const panel = {
      webview: {
        html: '',
        cspSource: 'vscode-resource:',
        asWebviewUri: (uri: unknown) => String(uri),
        onDidReceiveMessage: vi.fn(),
        postMessage: vi.fn(async () => true)
      },
      reveal: vi.fn(),
      onDidDispose: vi.fn(),
      dispose: vi.fn()
    };
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as never);

    await (startHere![1] as () => Promise<void>)();
    const calls = vi.mocked(vscode.window.createWebviewPanel).mock.calls;
    note(`H2 createWebviewPanel calls: ${calls.length}, view type: ${calls[0]?.[0]}`);
    expect(calls).toHaveLength(1);
    expect(calls[0]![0]).toBe('filemakerHome');
    expect(panel.webview.html).toContain('Build a Web App');
    expect(panel.webview.html).toContain('Advanced Tools');
    for (const subscription of ctx.subscriptions) subscription.dispose();
  });

  it('every catalogue command is registered in an untrusted workspace too, with a no-argument handler', async () => {
    const ctx = createActivationContext();
    (vscode.workspace as unknown as { isTrusted: boolean }).isTrusted = false;
    const { activate } = await import('/workspace/sureforge-fm-data-api-wt-home/extension/src/extension');
    await activate(ctx);

    const registered = new Map(vi.mocked(vscode.commands.registerCommand).mock.calls.map(([id, handler]) => [id, handler]));
    const missing = FILEMAKER_HOME_COMMANDS.filter((c) => !registered.has(c));
    note(`H3 catalogue commands missing in an untrusted workspace: ${JSON.stringify(missing)}`);
    expect(missing).toEqual([]);

    const withArguments = FILEMAKER_HOME_COMMANDS.filter((c) => (registered.get(c) as (...args: unknown[]) => unknown).length > 0);
    note(`H4 catalogue commands whose handler declares an optional argument: ${JSON.stringify(withArguments)}`);
    // Every one of them is also a Command Palette entry, which VS Code invokes with no argument
    // at all, so the zero-argument call the home makes is already a supported call shape.
    const palette = new Map(
      (JSON.parse(readFileSync(path.join(EXT, 'package.json'), 'utf8')) as {
        contributes: { menus: { commandPalette: Array<{ command: string; when?: string }> } };
      }).contributes.menus.commandPalette.map((entry) => [entry.command, entry.when])
    );
    const hiddenFromPalette = FILEMAKER_HOME_COMMANDS.filter((c) => palette.get(c) === 'false');
    note(`H5 catalogue commands hidden from the palette entirely: ${JSON.stringify(hiddenFromPalette)}`);
    expect(hiddenFromPalette).toEqual([]);
    for (const subscription of ctx.subscriptions) subscription.dispose();
  });
});

function installActivationMocks(): void {
  const disposable = () => ({ dispose: vi.fn() });
  const vscodeMock = vscode as unknown as {
    Disposable: new (callback: () => void) => vscode.Disposable;
    StatusBarAlignment: { Left: number; Right: number };
    ThemeColor: new (id: string) => unknown;
    window: typeof vscode.window & { registerTreeDataProvider: ReturnType<typeof vi.fn> };
    workspace: typeof vscode.workspace;
  };
  vscodeMock.Disposable = class {
    public constructor(private readonly callback: () => void) {}
    public dispose(): void {
      this.callback();
    }
  };
  vscodeMock.StatusBarAlignment = { Left: 1, Right: 2 };
  vscodeMock.ThemeColor = class {
    public constructor(public readonly id: string) {}
  };
  vscodeMock.window.createStatusBarItem = vi.fn(() => ({
    text: '',
    tooltip: undefined,
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn()
  })) as never;
  vscodeMock.window.registerTreeDataProvider = vi.fn(disposable);
  vscodeMock.workspace.onDidGrantWorkspaceTrust = vi.fn(disposable);
  vscodeMock.workspace.onDidChangeConfiguration = vi.fn(disposable);
  vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
    get: vi.fn((_key: string, defaultValue?: unknown) => defaultValue),
    inspect: vi.fn(() => undefined),
    update: vi.fn()
  } as never);
  vi.mocked(vscode.commands.registerCommand).mockImplementation(() => disposable());
}

function createActivationContext(): vscode.ExtensionContext {
  const profile = {
    id: 'p1',
    name: 'Development',
    serverUrl: 'https://fm.example.test',
    database: 'Contacts',
    authMode: 'direct',
    username: 'admin'
  };
  const globalState = {
    get: vi.fn((key: string, defaultValue?: unknown) =>
      key === 'filemakerDataApiTools.profiles' ? [profile] : defaultValue),
    update: vi.fn().mockResolvedValue(undefined),
    keys: vi.fn(() => []),
    setKeysForSync: vi.fn()
  };
  return {
    subscriptions: [],
    extensionUri: vscode.Uri.file('/test/extension'),
    globalState,
    workspaceState: globalState,
    secrets: {
      get: vi.fn().mockResolvedValue(undefined),
      store: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      onDidChange: vi.fn()
    },
    extension: { id: 'SureForgeTech.filemaker-data-api-tools', packageJSON: { version: '1.1.0' } },
    extensionMode: 1,
    asAbsolutePath: (p: string) => `/test/extension/${p}`
  } as unknown as vscode.ExtensionContext;
}

// Keep the unused import honest: the file needs the repo's mock of `vscode` to resolve.
void createRequire;
