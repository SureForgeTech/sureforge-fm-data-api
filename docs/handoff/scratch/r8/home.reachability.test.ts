/**
 * Independent reviewer scratch checks, part 2 for PR #579:
 *  - every catalogue entry's button really posts that command (end to end through the page script)
 *  - every catalogue command is registered by activate() (reachability, read from the running extension)
 *  - the theme audit measures the home's text and the muted text clears 4.5:1 in every audited theme
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';

import { FileMakerHomePanel } from '/workspace/sureforge-fm-data-api-wt-home/extension/src/webviews/home';
import {
  FILEMAKER_ADVANCED_SECTIONS,
  FILEMAKER_HOME_COMMANDS,
  FILEMAKER_HOME_SECTIONS
} from '/workspace/sureforge-fm-data-api-wt-home/extension/src/webviews/home/catalogue';

const EXT = '/workspace/sureforge-fm-data-api-wt-home/extension';
const REPO = '/workspace/sureforge-fm-data-api-wt-home';

const log: string[] = [];
const note = (line: string): void => {
  log.push(line);
  writeFileSync('/workspace/.fm-scratch/r8/result2.txt', log.join('\n') + '\n');
};

const client = readFileSync(path.join(EXT, 'src/webviews/home/ui/main.js'), 'utf8');
const manifest = JSON.parse(readFileSync(path.join(EXT, 'package.json'), 'utf8')) as {
  contributes: { commands: Array<{ command: string }> };
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

const require = createRequire(path.join(EXT, 'package.json'));
const { JSDOM } = require('jsdom') as { JSDOM: new (html: string, options: unknown) => { window: any } };

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

function openPanel(): string {
  vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as never);
  FileMakerHomePanel.createOrShow(context);
  return panel.webview.html;
}

beforeEach(() => {
  vi.clearAllMocks();
  dispose = undefined;
  receive = undefined;
  panel.webview.html = '';
});

afterEach(() => {
  dispose?.();
});

describe('every entry button posts its own command', () => {
  it('all 34 entries post the command the catalogue names, and the extension runs exactly that', async () => {
    const html = openPanel();
    const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://panel.invalid/' });
    const sent: unknown[] = [];
    Object.assign(dom.window, { acquireVsCodeApi: () => ({ postMessage: (m: unknown) => sent.push(m) }) });
    dom.window.eval(client);

    const buttons = Array.from(dom.window.document.querySelectorAll('button[data-command]')) as Array<{
      getAttribute(name: string): string | null;
      click(): void;
    }>;
    note(`E0 buttons rendered: ${buttons.length}, catalogue entries: ${FILEMAKER_HOME_COMMANDS.length}`);
    expect(buttons).toHaveLength(FILEMAKER_HOME_COMMANDS.length);

    for (const button of buttons) {
      const command = button.getAttribute('data-command');
      button.click();
      const last = sent[sent.length - 1];
      expect(last, command ?? '').toEqual({ type: 'run', command });
    }
    note(`E1 posted messages: ${sent.length}, every one {type:'run',command}: ${sent.every((m) => (m as { type: string }).type === 'run')}`);

    vi.mocked(vscode.commands.executeCommand).mockClear();
    for (const command of FILEMAKER_HOME_COMMANDS) {
      receive!({ type: 'run', command });
    }
    await Promise.resolve();
    const calls = vi.mocked(vscode.commands.executeCommand).mock.calls;
    note(`E2 executeCommand calls: ${calls.length}, ids in catalogue order: ${JSON.stringify(calls.map(([id]) => id) === JSON.stringify(FILEMAKER_HOME_COMMANDS))}`);
    expect(calls.map(([id]) => id)).toEqual(FILEMAKER_HOME_COMMANDS);
    expect(calls.every((call) => call.length === 1)).toBe(true);
  });
});

describe('every catalogue command is registered by activate()', () => {
  it('registers all of them', async () => {
    vi.resetModules();
    vi.clearAllMocks();
    installActivationMocks();
    const ctx = createActivationContext();
    const { activate } = await import('/workspace/sureforge-fm-data-api-wt-home/extension/src/extension');
    await activate(ctx);
    const registered = new Set(vi.mocked(vscode.commands.registerCommand).mock.calls.map(([id]) => id));
    const missing = FILEMAKER_HOME_COMMANDS.filter((c) => !registered.has(c));
    note(`F1 catalogue commands missing from activate(): ${JSON.stringify(missing)}`);
    expect(missing).toEqual([]);
    const contributedMissing = manifest.contributes.commands.map((c) => c.command).filter((c) => !registered.has(c));
    note(`F2 contributed commands missing from activate(): ${JSON.stringify(contributedMissing)}`);
    expect(contributedMissing).toEqual([]);
    note(`F3 registered total: ${registered.size}, contributed total: ${manifest.contributes.commands.length}`);
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

describe('theme audit of the home', () => {
  const compiledAudit = buildSync({
    entryPoints: [path.join(REPO, 'tools/theme-audit-colors.mjs')],
    bundle: true,
    packages: 'external',
    write: false,
    platform: 'node',
    format: 'cjs'
  });
  const auditModule = { exports: {} as Record<string, unknown> };
  new Function('module', 'exports', 'require', compiledAudit.outputFiles[0]!.text)(
    auditModule,
    auditModule.exports,
    createRequire(path.join(EXT, 'package.json'))
  );
  const audit = auditModule.exports as unknown as {
    themes: [string, string][];
    tokensFor: (theme: string) => Record<string, string>;
    measure: (css: string, body: string, tokens: Record<string, string>, excluded?: unknown[]) => Array<{
      selector: string;
      ratio: number;
    }>;
    disposeAudit: () => void;
  };

  it('measures the home text and clears 4.5:1 in every audited theme', () => {
    const compiled = buildSync({
      entryPoints: [path.join(REPO, 'shared/src/field-standards.ts')],
      bundle: true,
      write: false,
      platform: 'node',
      format: 'cjs'
    });
    const standardModule = { exports: {} as { standardFieldsCss: (webview?: boolean) => string } };
    new Function('module', compiled.outputFiles[0]!.text)(standardModule);
    const homeCss =
      standardModule.exports.standardFieldsCss(true) +
      readFileSync(path.join(EXT, 'src/webviews/home/ui/styles.css'), 'utf8');
    const body =
      '<div class="fm-home"><h1>FileMaker</h1><p class="lead">Start here. Everything else is under Advanced Tools.</p>' +
      '<section><h2>Build a Web App</h2><p>Make a web form that writes to FileMaker, without editing code or JSON.</p>' +
      '<div class="entry"><button type="button">Create FM Web App</button>' +
      '<span>Choose a starter, pick sample data or your own layout, then preview the form.</span></div></section>' +
      '<details><summary><strong>Advanced Tools</strong></summary></details>' +
      '<footer class="fm-version">FileMaker Data API Tools v1.9.1</footer></div>';
    for (const [theme] of audit.themes) {
      const tokens = audit.tokensFor(theme);
      const pairs = audit.measure(homeCss, body, tokens);
      const failures = pairs.filter((pair) => pair.ratio < 4.5);
      note(`G1 theme=${theme} measured=${pairs.length} failures=${failures.length}${failures.length ? ` -> ${JSON.stringify(failures)}` : ''}`);
      note(`G2 theme=${theme} ratios: ${pairs.map((p) => `${p.selector}=${p.ratio.toFixed(2)}`).join(' | ')}`);
      expect(pairs.length).toBeGreaterThan(0);
      expect(failures).toEqual([]);
    }
    audit.disposeAudit();
  });
});
