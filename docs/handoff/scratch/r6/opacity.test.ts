import { createRequire } from 'node:module';
import { buildSync } from 'esbuild';
import { describe, expect, it } from 'vitest';

const OUT = '/workspace/.fm-scratch/r6/opacity-out.txt';
const lines: string[] = [];
function log(line: string): void {
  lines.push(line);
  require('node:fs').writeFileSync(OUT, lines.join('\n') + '\n');
}

const root = '/workspace/sureforge-fm-data-api-wt-home';
const requireFromExtension = createRequire(`${root}/extension/package.json`);

interface ThemeAudit {
  disposeAudit: () => void;
  themes: [string, string][];
  tokensFor: (theme: string) => Record<string, string>;
  resolvedCss: (css: string, tokens: Record<string, string>, missing?: string[]) => string;
  measure: (
    css: string,
    body: string,
    tokens: Record<string, string>,
    excluded?: unknown[]
  ) => { selector: string; ratio: number; foreground: number[] }[];
}
const compiledAudit = buildSync({
  entryPoints: [`${root}/tools/theme-audit-colors.mjs`],
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

describe('r6 opacity probe', () => {
  it('does the repo audit apply opacity when it measures?', () => {
    const tokens = audit.tokensFor('light');
    const css = '.lead { opacity: 0.8; color: var(--vscode-foreground); } .plain { color: var(--vscode-foreground); }';
    const body = '<body><p class="lead">Lead</p><p class="plain">Plain</p></body>';
    const pairs = audit.measure(css, body, tokens);
    for (const pair of pairs) {
      log(`minimal css -> selector=${pair.selector} ratio=${pair.ratio.toFixed(2)} foreground=${JSON.stringify(pair.foreground)}`);
    }
    log(`resolved css = ${JSON.stringify(audit.resolvedCss(css, tokens))}`);
    expect(pairs.length).toBeGreaterThan(0);
  });

  it('does the repo audit apply opacity with a descendant selector?', () => {
    const tokens = audit.tokensFor('light');
    const css =
      '.fm-home .lead { opacity: 0.8; color: var(--vscode-foreground); } .fm-home .plain { color: var(--vscode-foreground); }';
    const body = '<body class="fm-page fm-home"><p class="lead">Lead</p><p class="plain">Plain</p></body>';
    const pairs = audit.measure(css, body, tokens);
    for (const pair of pairs) {
      log(`descendant css -> selector=${pair.selector} ratio=${pair.ratio.toFixed(2)} foreground=${JSON.stringify(pair.foreground)}`);
    }
    log(`resolved descendant css = ${JSON.stringify(audit.resolvedCss(css, tokens))}`);
  });
});
