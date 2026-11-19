import { writeFileSync } from 'node:fs';
import path from 'node:path';
import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const HOME = '/workspace/sureforge-fm-data-api-wt-home/extension/src/webviews/home';

const { FileMakerHomePanel } = await import(`${HOME}/index.ts`);
const catalogue = await import(`${HOME}/catalogue.ts`);

const OUT = '/workspace/.fm-scratch/r6/out.txt';
const lines: string[] = [];
function log(line: string): void {
  lines.push(line);
  writeFileSync(OUT, lines.join('\n') + '\n');
}

let dispose: () => void;
let receive: (message: unknown) => void;

const context = {
  extensionUri: { fsPath: '/extension' },
  subscriptions: []
} as unknown as vscode.ExtensionContext;

function fixture() {
  const webview = {
    html: '',
    cspSource: 'vscode-resource:',
    asWebviewUri: (uri: unknown) => String(uri),
    onDidReceiveMessage: (listener: typeof receive) => {
      receive = listener;
    },
    postMessage: vi.fn(async () => true)
  };
  const panel = {
    webview,
    reveal: vi.fn(),
    onDidDispose: (listener: () => void) => {
      dispose = listener;
    },
    dispose: vi.fn(() => dispose())
  };
  vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as never);
  FileMakerHomePanel.createOrShow(context);
  return { panel, webview };
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  dispose?.();
});

describe('r6 independent probe', () => {
  it('A: hostile messages never run an unlisted command', async () => {
    fixture();
    const hostile: unknown[] = [
      { type: 'run', command: 'workbench.action.terminal.new' },
      { type: 'run', command: 'filemakerDataApiTools.removeConnectionProfile' },
      { type: 'run', command: 'filemakerDataApiTools.startHere' },
      { type: 'run', command: 'fileMakerDataApiTools.connect' },
      { type: 'run', command: ' filemakerDataApiTools.connect' },
      { type: 'run', command: 'filemakerDataApiTools.connect ' },
      { type: 'run', command: 'filemakerDataApiTools.connect\n' },
      { type: 'run', command: '__proto__' },
      { type: 'run', command: 'constructor' },
      { type: 'run', command: 'toString' },
      { type: 'run', command: ['filemakerDataApiTools.connect'] },
      { type: 'run', command: { toString: () => 'filemakerDataApiTools.connect' } },
      { type: 'run', command: 42 },
      { type: 'run', command: null },
      { type: 'run' },
      { type: 'RUN', command: 'filemakerDataApiTools.connect' },
      { type: 'run ', command: 'filemakerDataApiTools.connect' },
      { command: 'filemakerDataApiTools.connect' },
      'run',
      ['run', 'filemakerDataApiTools.connect'],
      null,
      undefined,
      42,
      { type: 'run', command: 'filemakerDataApiTools.connect', profileId: 'p1' }
    ];
    for (const message of hostile) {
      await receive(message);
    }
    const calls = vi.mocked(vscode.commands.executeCommand).mock.calls;
    // The only allowed command in the list is filemakerDataApiTools.connect (it is a journey
    // entry), so exactly one call is expected: the listed command, with no arguments.
    log(`A: executeCommand calls after ${hostile.length} hostile messages = ${JSON.stringify(calls)}`);
    expect(calls).toEqual([['filemakerDataApiTools.connect']]);
    expect(calls[0]).toHaveLength(1);
  });

  it('B: a listed command runs with no arguments at all', async () => {
    fixture();
    await receive({ type: 'run', command: 'filemakerDataApiTools.connect' });
    const calls = vi.mocked(vscode.commands.executeCommand).mock.calls;
    log(`B: executeCommand calls = ${JSON.stringify(calls)}`);
    expect(calls).toEqual([['filemakerDataApiTools.connect']]);
    expect(calls[0]).toHaveLength(1);
  });

  it('C: hostile catalogue values are escaped in the rendered HTML', async () => {
    const payload = `"><img src=x onerror=alert(1)><script>alert(2)</script>&'`;
    const original = catalogue.FILEMAKER_HOME_SECTIONS[0]!.entries[0]!;
    const saved = { ...original };
    Object.assign(original, {
      label: payload,
      description: payload,
      command: payload
    });
    let html = '';
    try {
      html = fixture().webview.html;
    } finally {
      Object.assign(original, saved);
    }
    const hasRawImg = /<img/i.test(html);
    const hasRawScript = /<script>alert/i.test(html);
    const hasEscaped = html.includes('&lt;img src=x onerror=alert(1)&gt;');
    log(`C: raw <img> in html = ${hasRawImg}; raw <script> in html = ${hasRawScript}; escaped form present = ${hasEscaped}`);
    expect(hasRawImg).toBe(false);
    expect(hasRawScript).toBe(false);
    expect(hasEscaped).toBe(true);
    // The hostile command must not be executable: the allowlist still holds the original ids.
    const { FILEMAKER_HOME_COMMANDS } = catalogue;
    log(`C: allowlist contains hostile value = ${FILEMAKER_HOME_COMMANDS.includes(payload)}`);
    expect(FILEMAKER_HOME_COMMANDS.includes(payload)).toBe(false);
  });

  it('D: one panel only; reopening reveals the existing one', () => {
    const { panel } = fixture();
    FileMakerHomePanel.createOrShow(context);
    const created = vi.mocked(vscode.window.createWebviewPanel).mock.calls.length;
    log(`D: createWebviewPanel calls = ${created}; reveal calls = ${panel.reveal.mock.calls.length}; reveal arg = ${JSON.stringify(panel.reveal.mock.calls[0])}`);
    expect(created).toBe(1);
    expect(panel.reveal).toHaveBeenCalledTimes(1);
    expect(panel.reveal).toHaveBeenCalledWith(vscode.ViewColumn.One);
  });

  it('E: the CSP and the resource roots', () => {
    const { webview } = fixture();
    const csp = /Content-Security-Policy" content="([^"]*)"/.exec(webview.html)?.[1] ?? '';
    const options = vi.mocked(vscode.window.createWebviewPanel).mock.calls[0]?.[3] as
      | { enableScripts?: boolean; retainContextWhenHidden?: boolean; localResourceRoots?: Array<{ fsPath: string }> }
      | undefined;
    log(`E: csp = ${csp}`);
    log(`E: panel options = ${JSON.stringify(options)}`);
    expect(csp).toContain("default-src 'none'");
    expect(csp).toMatch(/script-src 'nonce-[A-Za-z0-9]{32}'/);
    expect(options?.enableScripts).toBe(true);
    expect(options?.retainContextWhenHidden).toBe(true);
    expect(options?.localResourceRoots?.map((r) => r.fsPath)).toEqual(['dist/webviews/home/ui']);
    // A second render uses a different nonce.
    const firstNonce = /nonce-([A-Za-z0-9]{32})/.exec(csp)?.[1];
    dispose?.();
    const second = fixture().webview.html;
    const secondNonce = /nonce-([A-Za-z0-9]{32})/.exec(second)?.[1];
    log(`E: first nonce = ${firstNonce}; second nonce = ${secondNonce}; different = ${firstNonce !== secondNonce}`);
    expect(firstNonce).toBeTruthy();
    expect(secondNonce).toBeTruthy();
    expect(firstNonce).not.toBe(secondNonce);
  });

  it('F: every rendered button is on the allowlist and every allowlist id has a button', () => {
    const { webview } = fixture();
    const rendered = [...webview.html.matchAll(/data-command="([^"]*)"/g)].map((m) => m[1]!);
    const allow = catalogue.FILEMAKER_HOME_COMMANDS;
    log(`F: rendered buttons = ${rendered.length}; allowlist = ${allow.length}`);
    log(`F: rendered not on allowlist = ${JSON.stringify(rendered.filter((r) => !allow.includes(r)))}`);
    log(`F: allowlist without a button = ${JSON.stringify(allow.filter((a) => !rendered.includes(a)))}`);
    expect(rendered.filter((r) => !allow.includes(r))).toEqual([]);
    expect(allow.filter((a) => !rendered.includes(a))).toEqual([]);
  });

  it('G: the DOM button attribute survives the escape round trip as the raw command id', async () => {
    const { webview } = fixture();
    const { JSDOM } = await import('/workspace/sureforge-fm-data-api-wt-home/extension/test/helpers/jsdomPage.ts');
    if (!JSDOM) throw new Error('jsdom missing');
    const dom = new JSDOM(webview.html, { runScripts: 'outside-only', url: 'https://panel.invalid/' });
    const button = dom.window.document.querySelector('button[data-command="filemakerDataApiTools.createFmWebApp"]');
    log(`G: DOM data-command = ${button?.getAttribute('data-command')}`);
    expect(button?.getAttribute('data-command')).toBe('filemakerDataApiTools.createFmWebApp');
  });

  it('H: catalogue ids are unique and every one is a contributed manifest command', () => {
    const manifest = JSON.parse(
      require('node:fs').readFileSync('/workspace/sureforge-fm-data-api-wt-home/extension/package.json', 'utf8')
    ) as { contributes: { commands: Array<{ command: string }> } };
    const contributed = new Set(manifest.contributes.commands.map((c) => c.command));
    const allow = catalogue.FILEMAKER_HOME_COMMANDS;
    const ids = [...allow];
    const dupes = ids.filter((id, index) => ids.indexOf(id) !== index);
    const notContributed = ids.filter((id) => !contributed.has(id));
    log(`H: duplicate ids = ${JSON.stringify(dupes)}; not contributed = ${JSON.stringify(notContributed)}`);
    expect(dupes).toEqual([]);
    expect(notContributed).toEqual([]);
  });
});
