import { readFileSync } from 'fs';
import path from 'path';
import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventRegistrationExample, type IntakeDefinition } from '@fmweb/shared';
import { FmWebAppPanel, renderAppEditor } from '../../src/webviews/fmWebApp';
import { JSDOM, type DomElement } from '../helpers/jsdomPage';

let dispose: () => void;
let receive: (message: unknown) => void;
let dom: InstanceType<NonNullable<typeof JSDOM>> | undefined;
const context = { extensionUri: { fsPath: '/extension' }, subscriptions: [] } as unknown as vscode.ExtensionContext;
const client = readFileSync(path.resolve(__dirname, '../../src/webviews/fmWebApp/ui/main.js'), 'utf8');
function fixture() {
  const app = eventRegistrationExample();
  const save = vi.fn<(definition: IntakeDefinition) => Promise<void>>().mockResolvedValue(undefined);
  const run = vi.fn<(action: string) => Promise<void>>().mockResolvedValue(undefined);
  const assertAvailable = vi.fn();
  const changeSource = vi.fn(async () => undefined);
  const webview = { html: '', cspSource: 'vscode-resource:', asWebviewUri: (uri: unknown) => String(uri),
    onDidReceiveMessage: (listener: typeof receive) => { receive = listener; },
    postMessage: vi.fn(async (message) => { dom?.window.dispatchEvent(new dom.window.MessageEvent('message', { data: message }));return true; }) };
  const panel = { webview, reveal: vi.fn(), onDidDispose: (listener: () => void) => { dispose = listener; }, dispose: vi.fn(() => dispose()) };
  vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as never);
  FmWebAppPanel.open(context, app.definition, app.layout, { save, run, assertAvailable, changeSource });
  return { app, save, run, assertAvailable, changeSource, panel, webview };
}
function browser(html: string) {
  if (!JSDOM) throw new Error('jsdom is required');
  dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://panel.invalid/' });
  const sent = vi.fn((message: unknown) => receive(message));
  Object.assign(dom.window, { acquireVsCodeApi: () => ({ postMessage: sent }) });
  dom.window.eval(client);return { window: dom.window, document: dom.window.document as typeof dom.window.document & { querySelector(selector: string): DomElement | null }, sent };
}
beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { dispose?.();if (dom) (dom.window as unknown as { close(): void }).close();dom = undefined; });

describe('FM Web app form editor', () => {
  it('saves changed labels, rules, choices, order and branding without opening JSON, then requests preview', async () => {
    const { webview, save, run } = fixture();const { document } = browser(webview.html);
    (document.getElementById('title') as DomElement).value = 'New workshop';
    (document.getElementById('organization') as DomElement).value = 'Example team';
    (document.querySelector('.field-label') as DomElement).value = 'Attendee name';
    (document.querySelector('.help') as DomElement).value = 'Enter your name';
    (document.querySelector('.required') as DomElement).checked = false;
    const rows = document.querySelectorAll('.app-field');
    (rows[2]!.querySelector('.choices') as DomElement).value = 'Morning\nEvening';
    (rows[3]!.querySelector('.include') as DomElement).checked = false;
    (rows[1]!.querySelector('[data-move="up"]') as DomElement).click();
    (document.querySelector('[data-action="preview"]') as DomElement).click();
    await vi.waitFor(() => expect(run).toHaveBeenCalledWith('preview'));
    expect(save).toHaveBeenCalledOnce();
    const definition = save.mock.calls[0]![0];
    expect(definition.title).toBe('New workshop');expect(definition.branding?.organizationName).toBe('Example team');
    expect(definition.fields.map((field) => field.id)).toEqual(['email', 'name', 'session']);
    expect(definition.fields[1]).toMatchObject({ fmFieldName: ' Full Name ', label: 'Attendee name', required: false, helpText: 'Enter your name' });
    expect(definition.fields[2]?.options).toEqual(['Morning', 'Evening']);
    expect(save.mock.invocationCallOrder[0]).toBeLessThan(run.mock.invocationCallOrder[0]!);
    expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
  });
  it('confirms changing fields without saving an invalid draft', async () => {
    const { webview, save, changeSource, panel } = fixture();const { document } = browser(webview.html);
    (document.getElementById('title') as DomElement).value = '';
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('Choose fields' as never);
    (document.querySelector('[data-action="source"]') as DomElement).click();
    await vi.waitFor(() => expect(changeSource).toHaveBeenCalledOnce());
    expect(save).not.toHaveBeenCalled();expect(panel.dispose).toHaveBeenCalledOnce();
  });
  it('keeps the editor and draft when changing fields is canceled', async () => {
    const { webview, save, changeSource, panel } = fixture();const { document } = browser(webview.html);
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(undefined);
    (document.querySelector('[data-action="source"]') as DomElement).click();
    await vi.waitFor(() => expect(webview.postMessage).toHaveBeenCalled());
    expect(save).not.toHaveBeenCalled();expect(changeSource).not.toHaveBeenCalled();expect(panel.dispose).not.toHaveBeenCalled();
  });
  it('marks a reordered saved form as unsaved', async () => {
    const { webview, save } = fixture();const { document } = browser(webview.html);
    (document.getElementById('save') as DomElement).click();
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(document.getElementById('status')?.textContent).toBe('App saved.'));
    (document.querySelectorAll('.app-field')[1]!.querySelector('[data-move="up"]') as DomElement).click();
    expect(document.getElementById('status')?.textContent).toBe('Unsaved changes');
  });
  it('refuses tampered targets, names and unsupported actions at the host boundary', async () => {
    const { app, save, webview } = fixture();
    for (const message of [null, { action: 'runScript', definition: app.definition },
      { action: 'save', definition: { ...app.definition, environmentId: 'live' } },
      { action: 'save', definition: { ...app.definition, fields: [{ ...app.definition.fields[0], fmFieldName: 'Admin' }] } }]) {
      receive(message);await vi.waitFor(() => expect(webview.postMessage).toHaveBeenCalled());webview.postMessage.mockClear();
    }
    expect(save).not.toHaveBeenCalled();
  });
  it('serializes saves and never starts preview after a failed save', async () => {
    const { app, save, run, webview } = fixture();
    let fail!: (reason: Error) => void;
    save.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { fail = reject; }));
    receive({ action: 'preview', definition: app.definition });receive({ action: 'preview', definition: app.definition });
    expect(save).toHaveBeenCalledOnce();fail(new Error('Edited elsewhere'));
    await vi.waitFor(() => expect(webview.postMessage).toHaveBeenCalledWith({ type: 'error', message: 'Edited elsewhere' }));
    expect(run).not.toHaveBeenCalled();
  });
  it('reports validation errors while keeping inputs editable and permits retry', async () => {
    const { webview, save } = fixture();const { document } = browser(webview.html);
    const label = document.querySelector('.field-label') as DomElement;label.value = ' ';
    (document.getElementById('save') as DomElement).click();
    await vi.waitFor(() => expect(document.getElementById('status')?.textContent).toContain('visible label'));
    expect(save).not.toHaveBeenCalled();expect(label.disabled).toBe(false);
    label.value = 'Corrected label';(document.getElementById('save') as DomElement).click();
    await vi.waitFor(() => expect(save).toHaveBeenCalledOnce());
  });
  it('escapes markup and script terminators in data, and shares the existing webview CSP/theme', () => {
    const app = eventRegistrationExample();app.definition.title = '</script><script>attack()</script>';
    const webview = { cspSource: 'vscode-resource:', asWebviewUri: () => 'vscode-resource:/main.js' } as never;
    const html = renderAppEditor(webview, context, app.definition, app.definition.fields);
    const page = browser(html);
    expect(page.document.querySelectorAll('script')).toHaveLength(2);
    expect(page.document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content')).toContain("default-src 'none'");
    expect((page.document.getElementById('title') as DomElement).value).toBe(app.definition.title);
  });
});
