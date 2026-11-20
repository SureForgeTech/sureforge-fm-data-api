import { readFileSync } from 'fs';
import path from 'path';
import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileMakerHomePanel } from '../../src/webviews/home';
import { FILEMAKER_ADVANCED_SECTIONS, FILEMAKER_HOME_COMMANDS, FILEMAKER_HOME_SECTIONS, FILEMAKER_TOOL_SECTIONS } from '../../src/webviews/home/catalogue';
import { JSDOM, type DomElement, type JsdomWindow } from '../helpers/jsdomPage';

let dispose: () => void;
let receive: (message: unknown) => void;
let dom: InstanceType<NonNullable<typeof JSDOM>> | undefined;
const context = { extensionUri: { fsPath: '/extension' }, subscriptions: [] } as unknown as vscode.ExtensionContext;
const client = readFileSync(path.resolve(__dirname, '../../src/webviews/home/ui/main.js'), 'utf8');
const manifest = JSON.parse(readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')) as {
  contributes: { commands: Array<{ command: string }> };
};

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

function browser(html: string) {
  if (!JSDOM) throw new Error('jsdom is required');
  dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://panel.invalid/' });
  const sent = vi.fn((message: unknown) => receive(message));
  Object.assign(dom.window, { acquireVsCodeApi: () => ({ postMessage: sent }) });
  dom.window.eval(client);
  return {
    window: dom.window,
    document: dom.window.document as typeof dom.window.document & { querySelector(selector: string): DomElement | null },
    sent
  };
}

/** Types into the home's filter, the way a reader would. */
function type(window: JsdomWindow, text: string): void {
  const input = window.document.getElementById('fm-home-filter-input');
  if (!input) throw new Error('the home has no filter');
  input.value = text;
  input.dispatchEvent(new window.Event('input'));
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  dispose?.();
  if (dom) (dom.window as unknown as { close(): void }).close();
  dom = undefined;
});

describe('FileMaker home', () => {
  it('offers the four journeys and the advanced tools', () => {
    const { webview } = fixture();
    for (const section of FILEMAKER_HOME_SECTIONS) {
      expect(webview.html).toContain(section.title);
    }
    expect(FILEMAKER_HOME_SECTIONS.map((section) => section.title)).toEqual([
      'Build a Web App',
      'Connect and Test',
      'Browse Data',
      'Help'
    ]);
    for (const section of FILEMAKER_ADVANCED_SECTIONS) {
      expect(webview.html).toContain(section.title);
    }
    for (const section of FILEMAKER_TOOL_SECTIONS) {
      expect(webview.html).toContain(section.title);
    }
    expect(webview.html).toContain('Advanced Tools');
  });

  it('runs the command a button names', async () => {
    const { webview } = fixture();
    const { document, sent } = browser(webview.html);
    const button = document.querySelector('button[data-command="filemakerDataApiTools.createFmWebApp"]') as DomElement;
    button.click();
    await vi.waitFor(() => expect(sent).toHaveBeenCalledWith({ type: 'run', command: 'filemakerDataApiTools.createFmWebApp' }));
  });

  it('runs only a command the home knows', async () => {
    fixture();
    await receive({ type: 'run', command: 'filemakerDataApiTools.createFmWebApp' });
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.createFmWebApp');
    vi.mocked(vscode.commands.executeCommand).mockClear();
    await receive({ type: 'run', command: 'workbench.action.terminal.new' });
    await receive({ type: 'run', command: '' });
    await receive({ type: 'something-else', command: 'filemakerDataApiTools.createFmWebApp' });
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
  });

  it('names only commands the extension contributes', () => {
    const contributed = new Set(manifest.contributes.commands.map(({ command }) => command));
    for (const command of FILEMAKER_HOME_COMMANDS) {
      expect(contributed.has(command), command).toBe(true);
    }
    expect(new Set(FILEMAKER_HOME_COMMANDS).size).toBe(FILEMAKER_HOME_COMMANDS.length);
  });

  it('names every command the extension contributes, so the home is a complete launcher', () => {
    const contributed = manifest.contributes.commands.map(({ command }) => command);
    for (const command of contributed) {
      expect(FILEMAKER_HOME_COMMANDS, command).toContain(command);
    }
    expect(FILEMAKER_HOME_COMMANDS.length).toBe(contributed.length);
  });

  it('gives every entry a unique id', () => {
    const ids = [...FILEMAKER_HOME_SECTIONS, ...FILEMAKER_ADVANCED_SECTIONS, ...FILEMAKER_TOOL_SECTIONS].flatMap((section) =>
      section.entries.map((entry) => entry.id)
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('narrows the commands to the ones that match what was typed', () => {
    const { webview } = fixture();
    const { window, document } = browser(webview.html);
    const all = Array.from(document.querySelectorAll('.entry'));
    expect(all.length).toBe(FILEMAKER_HOME_COMMANDS.length);

    type(window, 'schema');
    const shown = all.filter((entry) => !entry.classList.contains('fm-hidden'));
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.length).toBeLessThan(all.length);
    for (const entry of shown) {
      expect((entry.textContent ?? '').toLowerCase()).toContain('schema');
    }
  });

  it('hides a section that has nothing left in it', () => {
    const { webview } = fixture();
    const { window, document } = browser(webview.html);
    type(window, 'schema');
    for (const section of document.querySelectorAll('section')) {
      const entries = Array.from(section.querySelectorAll('.entry'));
      const anyShown = entries.some((entry) => !entry.classList.contains('fm-hidden'));
      expect(section.classList.contains('fm-hidden')).toBe(!anyShown);
    }
  });

  it('shows every command again when the filter is cleared', () => {
    const { webview } = fixture();
    const { window, document } = browser(webview.html);
    type(window, 'schema');
    type(window, '');
    const all = Array.from(document.querySelectorAll('.entry'));
    expect(all.every((entry) => !entry.classList.contains('fm-hidden'))).toBe(true);
    for (const section of document.querySelectorAll('section')) {
      expect(section.classList.contains('fm-hidden')).toBe(false);
    }
  });

  it('says so when nothing matches', () => {
    const { webview } = fixture();
    const { window, document } = browser(webview.html);
    const notice = document.getElementById('fm-home-no-matches');
    expect(notice).not.toBeNull();
    expect(notice?.classList.contains('fm-hidden')).toBe(true);
    type(window, 'no such command exists');
    expect(notice?.classList.contains('fm-hidden')).toBe(false);
    for (const entry of document.querySelectorAll('.entry')) {
      expect(entry.classList.contains('fm-hidden')).toBe(true);
    }
  });

  it('opens Advanced Tools when the only match is inside it', () => {
    const { webview } = fixture();
    const { window, document } = browser(webview.html);
    const advanced = document.querySelector('details');
    expect(advanced?.getAttribute('open')).toBeNull();
    type(window, 'circuit breaker');
    const shown = Array.from(document.querySelectorAll('.entry')).filter(
      (entry) => !entry.classList.contains('fm-hidden')
    );
    expect(shown.length).toBeGreaterThan(0);
    expect(advanced?.getAttribute('open')).not.toBeNull();
  });

  it('never runs a command while filtering', () => {
    const { webview } = fixture();
    const { window, sent } = browser(webview.html);
    type(window, 'schema');
    type(window, '');
    expect(sent).not.toHaveBeenCalled();
  });

  it('puts Advanced Tools back the way the reader had it when the filter is cleared', () => {
    const { webview } = fixture();
    const { window, document } = browser(webview.html);
    const advanced = document.querySelector('details');
    expect(advanced?.getAttribute('open')).toBeNull();
    type(window, 'circuit breaker');
    expect(advanced?.getAttribute('open')).not.toBeNull();
    type(window, '');
    expect(advanced?.getAttribute('open')).toBeNull();
  });

  it('does not match a word that spans the label and the description', () => {
    const { webview } = fixture();
    const { window, document } = browser(webview.html);
    for (const entry of Array.from(document.querySelectorAll('.entry'))) {
      const label = entry.querySelector('button')?.textContent ?? '';
      const description = entry.querySelector('span')?.textContent ?? '';
      const across = (label.slice(-3) + description.slice(0, 3)).toLowerCase();
      expect(across.length).toBe(6);
      type(window, across);
      expect(entry.classList.contains('fm-hidden'), across).toBe(true);
    }
  });
});
