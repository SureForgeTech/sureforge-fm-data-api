import { readFileSync } from 'fs';
import path from 'path';
import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileMakerHomePanel } from '../../src/webviews/home';
import { FILEMAKER_ADVANCED_SECTIONS, FILEMAKER_HOME_COMMANDS, FILEMAKER_HOME_SECTIONS } from '../../src/webviews/home/catalogue';
import { JSDOM, type DomElement } from '../helpers/jsdomPage';

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

  it('gives every entry a unique id', () => {
    const ids = [...FILEMAKER_HOME_SECTIONS, ...FILEMAKER_ADVANCED_SECTIONS].flatMap((section) =>
      section.entries.map((entry) => entry.id)
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});
