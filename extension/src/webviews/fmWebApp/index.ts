import * as vscode from 'vscode';
import { intakeDefinitionSchema, standardFieldsCss, type IntakeDefinition, type IntakeField, type LayoutDefinition } from '@fmweb/shared';
import { escapeHtml } from '../../utils/escapeHtml';
import { buildWebviewCsp, createNonce } from '../common/csp';
import { editableAppFields } from '../../services/fmWebAppModel';

export interface AppEditorActions {
  save(definition: IntakeDefinition): Promise<void>;
  run(action: 'preview' | 'export' | 'layout'): Promise<void>;
  assertAvailable(): void;
  changeSource?(): Promise<void>;
}

export class FmWebAppPanel {
  private static current: FmWebAppPanel | undefined;
  private busy = false;
  private disposed = false;
  private readonly fields: IntakeField[];

  static revealIfOpen(): boolean {
    if (!this.current) return false;
    this.current.panel.reveal(vscode.ViewColumn.One);return true;
  }

  static open(context: vscode.ExtensionContext, definition: IntakeDefinition, layout: LayoutDefinition, actions: AppEditorActions): void {
    if (this.revealIfOpen()) return;
    const panel = vscode.window.createWebviewPanel('filemakerFmWebApp', 'FM Web App — Event registration', vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webviews', 'fmWebApp', 'ui')] });
    const editor = new FmWebAppPanel(panel, definition, layout, actions);
    this.current = editor;context.subscriptions.push(panel);
    panel.webview.html = renderAppEditor(panel.webview, context, definition, editor.fields, layout.fmLayoutName);
  }

  private constructor(private readonly panel: vscode.WebviewPanel, private readonly original: IntakeDefinition,
    layout: LayoutDefinition, private readonly actions: AppEditorActions) {
    this.fields = editableAppFields(original, layout);
    panel.onDidDispose(() => { this.disposed = true;FmWebAppPanel.current = undefined; });
    panel.webview.onDidReceiveMessage((message: unknown) => { void this.receive(message); });
  }

  private async receive(message: unknown): Promise<void> {
    if (this.busy || this.disposed) return;
    this.busy = true;
    try {
      this.actions.assertAvailable();
      if (!message || typeof message !== 'object' || Array.isArray(message)) throw new Error('Invalid app editor request.');
      const request = message as Record<string, unknown>;
      if (!['save', 'preview', 'export', 'layout', 'source'].includes(String(request.action))
        || Object.keys(request).some((key) => !['action', 'definition'].includes(key))) throw new Error('Unsupported app editor action.');
      if (request.action === 'source') {
        const answer = await vscode.window.showWarningMessage('Choose a new field source? Unsaved edits in this tab will be discarded. Your saved app stays unchanged until you save the replacement.', { modal: true }, 'Choose fields');
        if (answer === 'Choose fields') { this.panel.dispose();await this.actions.changeSource?.(); }
        else await this.panel.webview.postMessage({ type: 'saved', message: 'Field source unchanged. Your edits remain in this tab.' });
        return;
      }
      const checked = intakeDefinitionSchema.safeParse(request.definition);
      if (!checked.success) throw new Error('Check the event title, labels and character limits. Single-choice fields need 1–100 unique choices, each at most 200 characters.');
      const definition = checked.data;
      if (definition.id !== this.original.id || definition.layoutId !== this.original.layoutId || definition.environmentId !== this.original.environmentId
        || definition.fields.some((field) => !this.fields.some((allowed) => allowed.id === field.id && allowed.fmFieldName === field.fmFieldName))) {
        throw new Error('Choose fields from this app’s source layout.');
      }
      if (!definition.title.trim() || definition.fields.some((field) => !field.label.trim())) throw new Error('Give the event and every included field a visible label.');
      await this.actions.save(definition);
      if (request.action !== 'save') await this.actions.run(request.action as 'preview' | 'export' | 'layout');
      if (!this.disposed) await this.panel.webview.postMessage({ type: 'saved', message: request.action === 'save' ? 'App saved.' : 'App saved. Follow the action’s status in VS Code.' });
    } catch (error) {
      if (!this.disposed) await this.panel.webview.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'Could not save the app.' });
    } finally { this.busy = false; }
  }
}

export function renderAppEditor(webview: vscode.Webview, context: vscode.ExtensionContext, definition: IntakeDefinition, fields: IntakeField[], sourceName = 'Sample registration fields'): string {
  const nonce = createNonce();
  const script = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, 'dist', 'webviews', 'fmWebApp', 'ui', 'main.js'));
  const selected = new Set(definition.fields.map((field) => field.id));
  const input = (id: string, label: string, value: string, max: number): string => `<label for="${id}">${label}</label><input id="${id}" value="${escapeHtml(value)}" maxlength="${max}" required />`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta http-equiv="Content-Security-Policy" content="${buildWebviewCsp(webview, { nonce, allowInlineStyleWithNonce: true })}"/>
<title>Create FM Web App</title><style nonce="${nonce}">${standardFieldsCss(true)}
body{max-width:1000px;margin:0 auto;padding:24px}label{display:block;margin-top:12px}input,select,textarea{box-sizing:border-box;max-width:100%;width:100%}input[type=checkbox]{width:auto}fieldset{margin:16px 0;padding:16px;border:1px solid var(--vscode-panel-border)}.actions{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.field-title{display:flex;align-items:center;gap:8px}.field-title label{margin:0}.field-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}.wide{grid-column:1/-1}code{white-space:pre-wrap;overflow-wrap:anywhere}button{cursor:pointer}#status{white-space:pre-wrap}#status.error{color:var(--vscode-errorForeground)}@media(max-width:600px){.field-grid{grid-template-columns:1fr}}
</style></head><body class="fm-page"><h1>Create FM Web App</h1><p>Event registration · Select fields, customize your form, then save and preview.</p><p>Field layout: <strong>${escapeHtml(sourceName)}</strong></p>
<p role="note">Preview accepts sample registrations only. Use invented details. No FileMaker records are created.</p>
<form id="app-form"><button type="button" data-action="source">Choose FileMaker fields</button><fieldset><legend>Event and branding</legend>
${input('title', 'Event title', definition.title, 160)}
<label for="description">Description</label><textarea id="description" maxlength="2000">${escapeHtml(definition.description)}</textarea>
<label for="organization">Organization</label><input id="organization" maxlength="120" value="${escapeHtml(definition.branding?.organizationName ?? '')}"/>
<label for="accent">Accent color</label><input id="accent" type="color" value="${escapeHtml(definition.branding?.accentColor ?? '#215EA6')}"/>
${input('submit-label', 'Submit button text', definition.submitLabel, 80)}
${input('success-message', 'Success message', definition.successMessage, 1000)}
</fieldset><h2>Registration fields</h2><p>Uncheck fields to exclude them. Use Move up or Move down to change their order. FileMaker names stay unchanged.</p>
<div id="fields">${fields.map((field, index) => `<fieldset class="app-field" data-field="${index}"><legend>${escapeHtml(field.label)}</legend>
<div class="field-title"><input type="checkbox" id="include-${index}" class="include" ${selected.has(field.id) ? 'checked' : ''}/><label for="include-${index}">Include field</label></div><p>FileMaker field: <code>${escapeHtml(field.fmFieldName)}</code></p>
<div class="field-grid"><div><label for="label-${index}">Label</label><input id="label-${index}" class="field-label" maxlength="200" required value="${escapeHtml(field.label)}"/></div>
<div><label for="kind-${index}">Input type</label><select id="kind-${index}" class="kind">${['text', 'email', 'number', 'date', 'textarea', 'select'].map((kind) => `<option value="${kind}" ${field.kind === kind ? 'selected' : ''}>${{ text: 'Text', email: 'Email', number: 'Number', date: 'Date', textarea: 'Long text', select: 'Single choice' }[kind]}</option>`).join('')}</select></div>
<div class="wide"><label for="help-${index}">Help text</label><input id="help-${index}" class="help" maxlength="1000" value="${escapeHtml(field.helpText)}"/></div>
<div><label for="required-${index}"><input id="required-${index}" type="checkbox" class="required" ${field.required ? 'checked' : ''}/> Required</label></div>
<div><label for="length-${index}">Maximum characters</label><input id="length-${index}" class="max-length" type="number" min="1" max="10000" value="${field.maxLength}"/></div>
<div class="wide"><label for="choices-${index}">Choices (one per line; used for Single choice)</label><textarea id="choices-${index}" class="choices">${escapeHtml((field.options ?? []).join('\n'))}</textarea></div></div>
<div class="actions"><button type="button" data-move="up" aria-label="Move ${escapeHtml(field.label)} up">Move up</button><button type="button" data-move="down" aria-label="Move ${escapeHtml(field.label)} down">Move down</button></div></fieldset>`).join('')}</div>
<div class="actions"><button type="button" data-action="preview">Save and preview</button><button type="submit" id="save" class="secondary">Save app</button></div><details><summary>Advanced tools</summary><div class="actions"><button type="button" data-action="export">Export app</button><button type="button" data-action="layout">Open source layout</button></div></details>
<p id="status" role="status" tabindex="-1">Save and preview to apply these form settings.</p></form>
<script nonce="${nonce}" id="app-model" type="application/json">${JSON.stringify({ definition, fields }).replace(/</g, '\\u003c')}</script>
<script nonce="${nonce}" src="${script}"></script></body></html>`;
}
