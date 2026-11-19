import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildSync } from 'esbuild';
import { afterAll, describe, expect, it } from 'vitest';

const OUT = '/workspace/.fm-scratch/r6/theme-out.txt';
const lines: string[] = [];
function log(line: string): void {
  lines.push(line);
  require('node:fs').writeFileSync(OUT, lines.join('\n') + '\n');
}

const root = '/workspace/sureforge-fm-data-api-wt-home';
const requireFromExtension = createRequire(path.join(root, 'extension', 'package.json'));

const standardModule = { exports: {} as { standardFieldsCss: (webview?: boolean) => string } };
new Function(
  'module',
  buildSync({ entryPoints: [path.join(root, 'shared/src/field-standards.ts')], bundle: true, write: false, format: 'cjs' }).outputFiles[0]!.text
)(standardModule);
const standardCss = standardModule.exports.standardFieldsCss(true);

interface ThemeAudit {
  disposeAudit: () => void;
  themes: [string, string][];
  tokensFor: (theme: string, overrides?: Record<string, string | null>) => Record<string, string>;
  resolveVars: (value: string, tokens: Record<string, string | null | undefined>, stack?: string[], missing?: string[]) => string;
  resolvedCss: (css: string, tokens: Record<string, string>, missing?: string[]) => string;
  measure: (css: string, body: string, tokens: Record<string, string>, excluded?: unknown[]) => { selector: string; ratio: number }[];
  presentationFailures: (css: string, body: string, tokens: Record<string, string>) => string[];
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
  requireFromExtension
);
const audit = auditModule.exports;
afterAll(() => audit.disposeAudit());

const homeCss = readFileSync(path.join(root, 'extension/src/webviews/home/ui/styles.css'), 'utf8');
const envCss = readFileSync(path.join(root, 'extension/src/webviews/environmentCompare/index.ts'), 'utf8');

const homeBody = [
  '<body class="fm-page fm-home">',
  '<h1>FileMaker</h1>',
  '<p class="lead">Start here. Everything else is under Advanced Tools.</p>',
  '<section><h2>Build a Web App</h2><p>Make a web form that writes to FileMaker.</p>',
  '<div class="entry"><button type="button">Create FM Web App</button><span>Choose a starter, then preview the form.</span></div>',
  '</section>',
  '<details><summary><strong>Advanced Tools</strong></summary>',
  '<section><h2>Setup</h2><p>Project setup.</p>',
  '<div class="entry"><button type="button">Show Diagnostics</button><span>A redacted report.</span></div>',
  '</section></details>',
  '<footer class="fm-version">FileMaker Data API Tools v1.9.1</footer>',
  '</body>'
].join('');

describe('r6 theme probe for the home panel', () => {
  it('lists the tokens the home stylesheet uses and any that do not resolve', () => {
    const tokens = [...homeCss.matchAll(/var\((--vscode-[A-Za-z0-9-]+)/g)].map((m) => m[1]!);
    log(`home stylesheet tokens: ${JSON.stringify([...new Set(tokens)])}`);
    for (const theme of audit.themes.map(([name]) => name)) {
      const missing: string[] = [];
      audit.resolvedCss(standardCss + homeCss, audit.tokensFor(theme), missing);
      log(`resolvedCss missing for ${theme}: ${JSON.stringify([...new Set(missing)])}`);
      expect([...new Set(missing)]).toEqual([]);
    }
  });

  it('measures the contrast of every text run on the home page in every theme', () => {
    for (const theme of audit.themes.map(([name]) => name)) {
      const tokens = audit.tokensFor(theme);
      const pairs = audit.measure(standardCss + homeCss, homeBody, tokens);
      for (const pair of pairs) {
        log(`${theme}: selector=${pair.selector} ratio=${pair.ratio.toFixed(2)}`);
      }
      const failures = audit.presentationFailures(standardCss + homeCss, homeBody, tokens);
      log(`${theme}: presentationFailures = ${JSON.stringify(failures)}`);
    }
  });

  it('measures the environment compare panel as a control', () => {
    const envStyles = [...envCss.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]!).join('\n');
    const body =
      '<section class="card"><h2>Environment Set: Dev</h2><p>Generated 2026-01-01</p>' +
      '<span class="badge ok">Profiles: 2</span><span class="badge warn">Diffs: 1</span>' +
      '<table><thead><tr><th>Layout</th></tr></thead><tbody><tr><td>Contacts</td></tr></tbody></table></section>' +
      '<footer class="fm-version">FileMaker Data API Tools v1.9.1</footer>';
    for (const theme of audit.themes.map(([name]) => name)) {
      const tokens = audit.tokensFor(theme);
      const pairs = audit.measure(standardCss + envStyles, body, tokens);
      for (const pair of pairs) {
        log(`control ${theme}: selector=${pair.selector} ratio=${pair.ratio.toFixed(2)}`);
      }
    }
  });
});
