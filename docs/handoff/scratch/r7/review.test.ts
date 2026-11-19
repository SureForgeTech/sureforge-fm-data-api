import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { buildSync } from 'esbuild';
import * as vscode from 'vscode';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FileMakerHomePanel } from '/workspace/sureforge-fm-data-api-wt-home/extension/src/webviews/home/index.ts';
import {
  FILEMAKER_ADVANCED_SECTIONS,
  FILEMAKER_HOME_COMMANDS,
  FILEMAKER_HOME_SECTIONS
} from '/workspace/sureforge-fm-data-api-wt-home/extension/src/webviews/home/catalogue.ts';

const root = '/workspace/sureforge-fm-data-api-wt-home';
const out: Record<string, unknown> = {};
const require = createRequire('/workspace/sureforge-fm-data-api-wt-home/package.json');

interface ContrastPair {
  selector: string;
  text?: string;
  ratio: number;
  foreground: number[];
  background: number[];
}
interface ThemeAudit {
  disposeAudit: () => void;
  themes: [string, string][];
  tokensFor: (theme: string) => Record<string, string>;
  measure: (css: string, body: string, tokens: Record<string, string>) => ContrastPair[];
  resolveVars: (value: string, tokens: Record<string, string>, stack?: string[], missing?: string[]) => string;
}

const compiledAudit = buildSync({
  entryPoints: [path.join(root, 'tools/theme-audit-colors.mjs')],
  bundle: true,
  packages: 'external',
  write: false,
  platform: 'node',
  format: 'cjs'
});
const auditModule = { exports: {} as ThemeAudit };
new Function('module', 'exports', 'require', compiledAudit.outputFiles[0]!.text)(
  auditModule,
  auditModule.exports,
  require
);
const audit = auditModule.exports;

const standardModule = { exports: {} as { standardFieldsCss: (webview?: boolean) => string } };
new Function(
  'module',
  buildSync({
    entryPoints: [path.join(root, 'shared/src/field-standards.ts')],
    bundle: true,
    write: false,
    format: 'cjs'
  }).outputFiles[0]!.text
)(standardModule);
const standardCss = standardModule.exports.standardFieldsCss(true);
const homeCss = readFileSync(path.join(root, 'extension/src/webviews/home/ui/styles.css'), 'utf8');
const css = standardCss + homeCss;

const homeBody =
  '<div class="fm-home"><h1>FileMaker</h1>' +
  '<p class="lead">Start here. Everything else is under Advanced Tools.</p>' +
  '<section><h2>Build a Web App</h2><p>Make a web form that writes to FileMaker.</p>' +
  '<div class="entry"><button type="button">Create FM Web App</button><span>Choose a starter.</span></div></section>' +
  '<details open><summary><strong>Advanced Tools</strong></summary>' +
  '<section><h2>Setup</h2><p>Project setup.</p></section></details>' +
  '<footer class="fm-version">FileMaker Data API Tools v1.9.0</footer></div>';

function summarize(pairs: ContrastPair[]) {
  return pairs.map((pair) => ({
    selector: pair.selector,
    text: pair.text,
    ratio: Number(pair.ratio.toFixed(3)),
    foreground: pair.foreground,
    background: pair.background
  }));
}

describe('home contrast, measured with the repository audit', () => {
  afterEach(() => {
    audit.disposeAudit();
  });

  it('measures every home text rule in every theme at >= 4.5 and proves the muted rule applied', () => {
    const byTheme: Record<string, unknown> = {};
    for (const [theme] of audit.themes) {
      const tokens = audit.tokensFor(theme);
      const pairs = audit.measure(css, homeBody, tokens);
      const failing = pairs.filter((pair) => pair.ratio < 4.5);
      const byText = Object.fromEntries(pairs.map((pair) => [pair.text ?? pair.selector, summarize([pair])[0]]));
      const lead = pairs.find((pair) => pair.text?.startsWith('Start here'));
      const heading = pairs.find((pair) => pair.text === 'FileMaker');
      byTheme[theme] = {
        count: pairs.length,
        selectors: pairs.map((pair) => pair.selector),
        failing: summarize(failing),
        pairs: summarize(pairs),
        byText,
        leadDiffersFromHeading: Boolean(lead && heading && lead.foreground.join() !== heading.foreground.join())
      };
      expect(failing, theme).toEqual([]);
      expect(lead, theme).toBeDefined();
      expect(heading, theme).toBeDefined();
      expect(pairs.find((pair) => pair.text === 'Choose a starter.'), theme).toBeDefined();
      expect(pairs.find((pair) => pair.text?.includes('v1.9.0')), theme).toBeDefined();
      expect(lead!.foreground.join(), theme).not.toBe(heading!.foreground.join());
      expect(lead!.ratio, theme).toBeGreaterThanOrEqual(4.5);
    }
    out.contrast = byTheme;
  });

  it('the repository guard fails when the muted colour is broken, and does not see a child combinator or descendant opacity', () => {
    const tokens = audit.tokensFor('light');
    const brokenColor = css.replaceAll('color: var(--muted);', 'color: #ffffff;');
    const broken = audit.measure(brokenColor, homeBody, tokens).filter((pair) => pair.ratio < 4.5);
    const childOnly =
      '.fm-home > .lead { color: #ffffff; } .fm-home > section > p { color: #ffffff; } .fm-home > .entry > span { color: #ffffff; }';
    const childPairs = audit.measure(standardCss + childOnly, homeBody, tokens);
    const leadAfterChild = childPairs.find((pair) => pair.text?.startsWith('Start here'));
    const headingAfterChild = childPairs.find((pair) => pair.text === 'FileMaker');
    const opacityCss = standardCss + '.fm-home .lead { opacity: 0.4; } .fm-home .fm-version { opacity: 0.4; }';
    const opacityPairs = audit.measure(opacityCss, homeBody, tokens);
    const leadOpacity = opacityPairs.find((pair) => pair.text?.startsWith('Start here'));
    const headingOpacity = opacityPairs.find((pair) => pair.text === 'FileMaker');
    out.guard = {
      brokenBelow45: summarize(broken).map((pair) => pair.selector + ' ' + pair.ratio),
      childCombinatorLeadMatchesHeading:
        leadAfterChild && headingAfterChild
          ? leadAfterChild.foreground.join() === headingAfterChild.foreground.join()
          : null,
      childLeadRatio: leadAfterChild?.ratio,
      descendantOpacityLeadMatchesHeading:
        leadOpacity && headingOpacity ? leadOpacity.foreground.join() === headingOpacity.foreground.join() : null,
      descendantOpacityLeadRatio: leadOpacity?.ratio,
      descendantOpacityFooterRatio: opacityPairs.find((pair) => pair.selector === 'footer.fm-version')?.ratio
    };
    expect(broken.length).toBeGreaterThan(0);
    expect(leadAfterChild).toBeDefined();
    expect(headingAfterChild).toBeDefined();
    expect(leadOpacity).toBeDefined();
    expect(headingOpacity).toBeDefined();
  });
});

describe('home panel security and catalogue', () => {
  let dispose: () => void;
  let receive: (message: unknown) => void;

  function open() {
    const webview = {
      html: '',
      cspSource: 'vscode-resource:',
      asWebviewUri: (uri: { toString?: () => string }) => `vscode-webview://home/${String(uri)}`,
      onDidReceiveMessage: (listener: typeof receive) => {
        receive = listener;
        return { dispose: () => undefined };
      },
      postMessage: vi.fn(async () => true)
    };
    const panel = {
      webview,
      reveal: vi.fn(),
      onDidDispose: (listener: () => void) => {
        dispose = listener;
        return { dispose: () => undefined };
      },
      dispose: vi.fn(() => dispose())
    };
    vi.mocked(vscode.window.createWebviewPanel).mockReturnValue(panel as never);
    const context = { extensionUri: { fsPath: '/extension' }, subscriptions: [] } as unknown as vscode.ExtensionContext;
    FileMakerHomePanel.createOrShow(context);
    return { panel, webview, context };
  }

  afterEach(() => {
    dispose?.();
    vi.clearAllMocks();
  });

  it('rejects hostile messages and escapes a hostile catalogue value', async () => {
    const hostile = {
      id: 'hostile',
      title: '<img src=x onerror=alert(1)>',
      description: '"></section><script>alert(1)</script>',
      entries: [
        {
          id: 'hostile-entry',
          label: '<b>xss</b>',
          description: "';alert(1)//",
          command: 'filemakerDataApiTools.createFmWebApp"><img src=x onerror=alert(1)>'
        }
      ]
    };
    FILEMAKER_HOME_SECTIONS.push(hostile);
    FILEMAKER_HOME_COMMANDS.push(hostile.entries[0]!.command);
    const { webview, panel } = open();
    const html = webview.html;
    FILEMAKER_HOME_SECTIONS.pop();
    FILEMAKER_HOME_COMMANDS.pop();

    const executed: unknown[][] = [];
    vi.mocked(vscode.commands.executeCommand).mockImplementation((...args: unknown[]) => {
      executed.push(args);
      return Promise.resolve(undefined);
    });

    const attacks: unknown[] = [
      null,
      undefined,
      'run',
      1,
      [],
      { type: 'run', command: 'workbench.action.files.save' },
      { type: 'run', command: 'filemakerDataApiTools.startHere' },
      { type: 'run', command: 'filemakerDataApiTools.createFmWebApp\u0000' },
      { type: 'run' },
      { type: 'run', command: { toString: () => 'filemakerDataApiTools.createFmWebApp' } },
      { type: 'run', command: ['filemakerDataApiTools.createFmWebApp'] },
      { type: 'something', command: 'filemakerDataApiTools.createFmWebApp' },
      { command: 'filemakerDataApiTools.createFmWebApp' },
      Object.create({ type: 'run', command: 'workbench.action.reloadWindow' })
    ];
    for (const message of attacks) await receive(message);
    await receive({ type: 'run', command: 'filemakerDataApiTools.createFmWebApp', args: ['evil'] });

    const options = vi.mocked(vscode.window.createWebviewPanel).mock.calls[0]?.[3] as {
      localResourceRoots?: Array<{ toString?: () => string }>;
      enableScripts?: boolean;
    };
    out.security = {
      executed,
      htmlHasRawScript: /<script(?![^>]*nonce=)/i.test(html) || html.includes('<script>alert'),
      htmlHasOnerror: /onerror=/i.test(html),
      htmlHasRawImg: html.includes('<img'),
      escapedImg: html.includes('&lt;img'),
      escapedScript: html.includes('&lt;script&gt;') || html.includes('&lt;/script&gt;'),
      attributeBreak: html.includes('"><img'),
      csp: html.match(/Content-Security-Policy" content="([^"]*)"/)?.[1] ?? null,
      scriptNonce: /<script nonce="[A-Za-z0-9]+" src=/.test(html),
      linksStandards: html.includes('fieldStandards.css'),
      standardsBeforeHome: html.indexOf('fieldStandards.css') < html.indexOf('styles.css'),
      localResourceRoots: options?.localResourceRoots?.map((uri) => String(uri)),
      enableScripts: options?.enableScripts,
      secondOpenCreatesAnotherPanel: false
    };

    FileMakerHomePanel.createOrShow({ extensionUri: { fsPath: '/extension' } } as never);
    out.security = {
      ...(out.security as object),
      revealCalls: panel.reveal.mock.calls.length,
      createCalls: vi.mocked(vscode.window.createWebviewPanel).mock.calls.length
    };

    expect(executed).toEqual([['filemakerDataApiTools.createFmWebApp']]);
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toMatch(/<img\b/i);
    expect(html).toMatch(/script-src 'nonce-[A-Za-z0-9]+'/);
    expect(html).toContain("default-src 'none'");
    expect(html).toContain('fieldStandards.css');
    expect(panel.reveal).toHaveBeenCalledTimes(1);
    expect(vi.mocked(vscode.window.createWebviewPanel)).toHaveBeenCalledTimes(1);
  });

  it('compares catalogue labels with manifest titles and lists commands the home does not name', () => {
    const manifest = JSON.parse(readFileSync(path.join(root, 'extension/package.json'), 'utf8')) as {
      contributes: {
        commands: Array<{ command: string; title: string; category?: string }>;
        menus: { commandPalette: Array<{ command: string; when?: string }> };
        keybindings: Array<{ command: string; key: string }>;
      };
    };
    const titles = new Map(manifest.contributes.commands.map((command) => [command.command, command.title]));
    const entries = [...FILEMAKER_HOME_SECTIONS, ...FILEMAKER_ADVANCED_SECTIONS].flatMap((section) => section.entries);
    const mismatches = entries
      .filter((entry) => titles.get(entry.command) !== entry.label)
      .map((entry) => ({ command: entry.command, label: entry.label, title: titles.get(entry.command) ?? null }));
    const missing = entries.filter((entry) => !titles.has(entry.command)).map((entry) => entry.command);
    const paletteHidden = new Map(
      manifest.contributes.menus.commandPalette.map((item) => [item.command, item.when ?? ''])
    );
    const notInHome = manifest.contributes.commands
      .filter((command) => !FILEMAKER_HOME_COMMANDS.includes(command.command) && command.command !== 'filemakerDataApiTools.startHere')
      .map((command) => ({
        command: command.command,
        title: command.title,
        paletteWhen: paletteHidden.get(command.command) ?? 'always shown'
      }));
    out.catalogue = {
      entryCount: entries.length,
      unique: new Set(entries.map((entry) => entry.command)).size,
      mismatches,
      missing,
      notInHome
    };
    expect(missing).toEqual([]);
    expect(mismatches).toEqual([]);
  });
});

afterEach(() => {
  writeFileSync('/workspace/.fm-scratch/r7/results.json', JSON.stringify(out, null, 2));
});
