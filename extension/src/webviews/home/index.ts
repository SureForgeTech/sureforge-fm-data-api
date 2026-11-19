import * as vscode from 'vscode';

import { versionFooterHtml } from '../../about/runtimeVersion';
import { buildWebviewCsp, createNonce } from '../common/csp';
import { toRecord } from '../common/messageValidation';
import { FILEMAKER_ADVANCED_SECTIONS, FILEMAKER_HOME_COMMANDS, FILEMAKER_HOME_SECTIONS, type HomeSection } from './catalogue';

/**
 * The FileMaker home: the four journeys and the advanced tools, each entry running a contributed
 * command. The page can only ask for a command this panel knows, so a message from the page cannot
 * run anything else.
 */
export class FileMakerHomePanel {
  private static currentPanel: FileMakerHomePanel | undefined;

  private constructor(private readonly panel: vscode.WebviewPanel, private readonly context: vscode.ExtensionContext) {
    this.panel.webview.html = this.renderHtml(this.panel.webview);
    this.panel.onDidDispose(() => {
      FileMakerHomePanel.currentPanel = undefined;
    });
    this.panel.webview.onDidReceiveMessage((message: unknown) => {
      void this.handleMessage(message);
    });
  }

  public static createOrShow(context: vscode.ExtensionContext): void {
    const current = FileMakerHomePanel.currentPanel;
    if (current) {
      current.panel.reveal(vscode.ViewColumn.One);
      return;
    }
    const panel = vscode.window.createWebviewPanel('filemakerHome', 'FileMaker', vscode.ViewColumn.One, {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webviews', 'home', 'ui')]
    });
    FileMakerHomePanel.currentPanel = new FileMakerHomePanel(panel, context);
  }

  private async handleMessage(message: unknown): Promise<void> {
    const record = toRecord(message);
    if (!record || record['type'] !== 'run') return;
    const command = typeof record['command'] === 'string' ? record['command'] : '';
    if (!FILEMAKER_HOME_COMMANDS.includes(command)) return;
    await vscode.commands.executeCommand(command);
  }

  private renderHtml(webview: vscode.Webview): string {
    const nonce = createNonce();
    const csp = buildWebviewCsp(webview, { nonce });
    const uiBase = vscode.Uri.joinPath(this.context.extensionUri, 'dist', 'webviews', 'home', 'ui');
    const script = webview.asWebviewUri(vscode.Uri.joinPath(uiBase, 'main.js'));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(uiBase, 'styles.css'));
    const standardsStyle = webview.asWebviewUri(vscode.Uri.joinPath(uiBase, 'fieldStandards.css'));
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FileMaker</title>
<link rel="stylesheet" href="${standardsStyle}" />
<link rel="stylesheet" href="${style}" />
</head>
<body class="fm-page fm-home">
<h1>FileMaker</h1>
<p class="lead">Start here. Everything else is under Advanced Tools.</p>
${renderSections(FILEMAKER_HOME_SECTIONS)}
<details>
<summary><strong>Advanced Tools</strong></summary>
${renderSections(FILEMAKER_ADVANCED_SECTIONS)}
</details>
${versionFooterHtml()}
<script nonce="${nonce}" src="${script}"></script>
</body>
</html>`;
  }
}

function renderSections(sections: HomeSection[]): string {
  return sections
    .map(
      (section) =>
        `<section><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.description)}</p>${section.entries
          .map(
            (entry) =>
              `<div class="entry"><button type="button" data-command="${escapeHtml(entry.command)}">${escapeHtml(
                entry.label
              )}</button><span>${escapeHtml(entry.description)}</span></div>`
          )
          .join('')}</section>`
    )
    .join('');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
