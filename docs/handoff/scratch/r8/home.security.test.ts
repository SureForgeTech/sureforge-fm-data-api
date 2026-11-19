/**
 * Independent reviewer scratch checks for PR #579 (FileMaker home) on head ee671e9.
 * Written from scratch; not derived from the PR's own test file.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';

const EXT = '/workspace/sureforge-fm-data-api-wt-home/extension';

import { FileMakerHomePanel } from '/workspace/sureforge-fm-data-api-wt-home/extension/src/webviews/home';
import {
  FILEMAKER_ADVANCED_SECTIONS,
  FILEMAKER_HOME_COMMANDS,
  FILEMAKER_HOME_SECTIONS
} from '/workspace/sureforge-fm-data-api-wt-home/extension/src/webviews/home/catalogue';
import { RESTORABLE_PANELS, LIVE_SERIALIZER_PANELS } from '/workspace/sureforge-fm-data-api-wt-home/extension/src/webviews/common/panelRestore';

const log: string[] = [];
const note = (line: string): void => {
  log.push(line);
  writeFileSync('/workspace/.fm-scratch/r8/result.txt', log.join('\n') + '\n');
};

const manifest = JSON.parse(readFileSync(path.join(EXT, 'package.json'), 'utf8')) as {
  contributes: {
    commands: Array<{ command: string; title: string; category?: string }>;
    keybindings: Array<{ command: string; key: string; when?: string }>;
    menus: Record<string, Array<{ command: string; when?: string; group?: string }>>;
    viewsWelcome: Array<{ view: string; contents: string }>;
  };
  activationEvents: string[];
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

function openPanel(): void {
  vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as never);
  FileMakerHomePanel.createOrShow(context);
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

describe('1. the message allowlist', () => {
  it('runs a catalogue command with no arguments at all', async () => {
    openPanel();
    await receive!({ type: 'run', command: 'filemakerDataApiTools.createFmWebApp' });
    const calls = vi.mocked(vscode.commands.executeCommand).mock.calls;
    note(`A1 executeCommand call count: ${calls.length}`);
    expect(calls).toHaveLength(1);
    // Exactly one argument: the command id. No arguments can be injected.
    expect(calls[0]!.length).toBe(1);
    expect(calls[0]![0]).toBe('filemakerDataApiTools.createFmWebApp');
    note(`A1 executeCommand args: ${JSON.stringify(calls[0])}`);
  });

  it('refuses every command that is not in the catalogue', async () => {
    openPanel();
    const rejected = [
      'workbench.action.terminal.new',
      'filemakerDataApiTools.startHere',
      'filemakerDataApiTools.createFmWebApp ', // trailing space
      ' filemakerDataApiTools.createFmWebApp',
      'FILEMAKERDATAAPITOOLS.CREATEFMWEBAPP',
      'filemakerDataApiTools.createFmWebApp;drop',
      '',
      'constructor',
      '__proto__',
      'toString'
    ];
    for (const command of rejected) {
      await receive!({ type: 'run', command });
    }
    note(`A2 rejected commands -> executeCommand calls: ${vi.mocked(vscode.commands.executeCommand).mock.calls.length}`);
    expect(vi.mocked(vscode.commands.executeCommand)).not.toHaveBeenCalled();
  });

  it('refuses a message whose type is not exactly run', async () => {
    openPanel();
    for (const message of [
      { command: 'filemakerDataApiTools.createFmWebApp' },
      { type: 'Run', command: 'filemakerDataApiTools.createFmWebApp' },
      { type: 'run ', command: 'filemakerDataApiTools.createFmWebApp' },
      { type: 'run', command: 42 },
      { type: 'run', command: { toString: () => 'filemakerDataApiTools.createFmWebApp' } },
      { type: 'run', command: ['filemakerDataApiTools.createFmWebApp'] },
      null,
      undefined,
      'run',
      7
    ]) {
      await receive!(message);
    }
    note(`A3 non-run/odd messages -> executeCommand calls: ${vi.mocked(vscode.commands.executeCommand).mock.calls.length}`);
    expect(vi.mocked(vscode.commands.executeCommand)).not.toHaveBeenCalled();
  });

  it('ignores any extra fields a page might add to a run message', async () => {
    openPanel();
    await receive!({ type: 'run', command: 'filemakerDataApiTools.createFmWebApp', args: ['evil'], extra: 1 });
    const calls = vi.mocked(vscode.commands.executeCommand).mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0]!.length).toBe(1);
    note(`A4 extra fields ignored, args seen: ${JSON.stringify(calls[0])}`);
  });

  it('every catalogue command is on the allowlist and the allowlist has no extras', () => {
    const allowlist = new Set(FILEMAKER_HOME_COMMANDS);
    const fromEntries = new Set([
      ...FILEMAKER_HOME_SECTIONS.flatMap((s) => s.entries.map((e) => e.command)),
      ...FILEMAKER_ADVANCED_SECTIONS.flatMap((s) => s.entries.map((e) => e.command))
    ]);
    expect([...fromEntries].filter((c) => !allowlist.has(c))).toEqual([]);
    expect(allowlist.size).toBe(fromEntries.size);
    note(`A5 allowlist size ${allowlist.size}, entries ${fromEntries.size}`);
  });
});

describe('2. escaping of every catalogue value that reaches the HTML', () => {
  it('escapes a hostile label, description, title and command', () => {
    const hostile = '<img src=x onerror=alert(1)>';
    const first = FILEMAKER_HOME_SECTIONS[0]!;
    const original = {
      title: first.title,
      description: first.description,
      label: first.entries[0]!.label,
      entryDescription: first.entries[0]!.description,
      command: first.entries[0]!.command
    };
    first.title = hostile;
    first.description = hostile;
    first.entries[0]!.label = hostile;
    first.entries[0]!.description = hostile;
    first.entries[0]!.command = hostile;
    try {
      openPanel();
      const html = panel.webview.html;
      note(`B1 hostile markup present in html: ${html.includes(hostile)}`);
      expect(html).not.toContain(hostile);
      expect(html).not.toContain('<img');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    } finally {
      first.title = original.title;
      first.description = original.description;
      first.entries[0]!.label = original.label;
      first.entries[0]!.description = original.entryDescription;
      first.entries[0]!.command = original.command;
    }
  });

  it('escapes the double quote that would break out of the data-command attribute', () => {
    const first = FILEMAKER_HOME_SECTIONS[0]!;
    const original = first.entries[0]!.command;
    first.entries[0]!.command = 'a" onmouseover="alert(1)';
    try {
      openPanel();
      const html = panel.webview.html;
      note(`B2 raw attribute break present: ${html.includes('onmouseover="alert(1)"')}`);
      expect(html).not.toContain('onmouseover="alert(1)"');
      expect(html).toContain('&quot;');
    } finally {
      first.entries[0]!.command = original;
    }
  });

  it('escapes the static catalogue values that reach the HTML', () => {
    openPanel();
    const html = panel.webview.html;
    for (const section of [...FILEMAKER_HOME_SECTIONS, ...FILEMAKER_ADVANCED_SECTIONS]) {
      expect(html).toContain(section.title);
      for (const entry of section.entries) {
        expect(html).toContain(`data-command="${entry.command}"`);
        expect(html).toContain(entry.label);
      }
    }
    note('B3 all static catalogue values present in the rendered HTML');
  });
});

describe('3. panel lifecycle and restore', () => {
  it('reopening reveals the existing panel instead of making a second one', () => {
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as never);
    FileMakerHomePanel.createOrShow(context);
    FileMakerHomePanel.createOrShow(context);
    FileMakerHomePanel.createOrShow(context);
    note(`C1 createWebviewPanel calls: ${vi.mocked(vscode.window.createWebviewPanel).mock.calls.length}, reveal calls: ${panel.reveal.mock.calls.length}`);
    expect(vi.mocked(vscode.window.createWebviewPanel).mock.calls).toHaveLength(1);
    expect(panel.reveal).toHaveBeenCalledTimes(2);
    expect(panel.reveal).toHaveBeenCalledWith(vscode.ViewColumn.One);
  });

  it('after the panel is closed a new one can be opened', () => {
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as never);
    FileMakerHomePanel.createOrShow(context);
    dispose?.();
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as never);
    FileMakerHomePanel.createOrShow(context);
    note(`C2 createWebviewPanel calls after dispose + reopen: ${vi.mocked(vscode.window.createWebviewPanel).mock.calls.length}`);
    expect(vi.mocked(vscode.window.createWebviewPanel)).toHaveBeenCalledTimes(2);
  });

  it('the home is in the restore list with the palette title of a contributed command', () => {
    const entry = RESTORABLE_PANELS.find((p) => p.viewType === 'filemakerHome');
    note(`C3 restore entry: ${JSON.stringify(entry)}`);
    expect(entry).toBeDefined();
    expect(entry!.reopenWith).toBe('FileMaker: Start Here');
    expect(LIVE_SERIALIZER_PANELS).not.toContain('filemakerHome');
    const titles = new Set(manifest.contributes.commands.map((c) => `${c.category ?? 'FileMaker'}: ${c.title}`));
    expect(titles.has('FileMaker: Start Here')).toBe(true);
    expect(manifest.activationEvents).toContain('onWebviewPanel:filemakerHome');
  });

  it('the webview is created with scripts enabled and only its own folder as a resource root', () => {
    openPanel();
    const call = vi.mocked(vscode.window.createWebviewPanel).mock.calls[0]!;
    note(`C4 createWebviewPanel args: ${JSON.stringify(call[0])} ${JSON.stringify(call[1])} ${JSON.stringify(call[2])} ${JSON.stringify(call[3])}`);
    expect(call[0]).toBe('filemakerHome');
    expect(call[2]).toBe(vscode.ViewColumn.One);
    expect(call[3]).toMatchObject({ enableScripts: true, retainContextWhenHidden: true });
  });

  it('the rendered page has a nonce-bound script policy and no inline script', () => {
    openPanel();
    const html = panel.webview.html;
    const csp = /Content-Security-Policy" content="([^"]+)"/.exec(html)?.[1] ?? '';
    note(`C5 csp: ${csp}`);
    expect(csp).toMatch(/script-src 'nonce-[A-Za-z0-9]{32}'/);
    expect(csp).toContain("default-src 'none'");
    expect(html).not.toMatch(/<script(?![^>]*nonce=)/);
  });
});

describe('4. reachability of every catalogue command', () => {
  it('every catalogue command is contributed by the manifest', () => {
    const contributed = new Set(manifest.contributes.commands.map((c) => c.command));
    const missing = FILEMAKER_HOME_COMMANDS.filter((c) => !contributed.has(c));
    note(`D1 catalogue commands not contributed: ${JSON.stringify(missing)}`);
    expect(missing).toEqual([]);
  });

  it('the manifest command count and ids are unchanged apart from the new one', () => {
    note(`D2 manifest contributed commands: ${manifest.contributes.commands.length}`);
    expect(manifest.contributes.commands.length).toBe(80);
    const ids = manifest.contributes.commands.map((c) => c.command);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the keybindings are the same five as before the branch', () => {
    const bindings = manifest.contributes.keybindings.map((k) => `${k.command}|${k.key}|${k.when ?? ''}`);
    note(`D3 keybindings: ${JSON.stringify(bindings)}`);
    expect(bindings).toEqual([
      'filemakerDataApiTools.openQueryBuilder|ctrl+alt+q|filemaker.hasProfiles',
      'filemakerDataApiTools.openRecordViewer|ctrl+alt+v|filemaker.hasProfiles',
      'filemakerDataApiTools.openScriptRunner|ctrl+alt+e|filemaker.hasProfiles',
      'filemakerDataApiTools.showRequestHistory|ctrl+alt+h|filemaker.powerUserMode',
      'filemakerDataApiTools.openLayoutMode|ctrl+alt+l|filemaker.fmWebProjectInitialized'
    ]);
  });
});
