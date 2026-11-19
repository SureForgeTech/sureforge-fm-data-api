import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { buildSync } from 'esbuild';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = '/workspace/sureforge-fm-data-api-wt-home';
const require = createRequire(import.meta.url);
const compiled = buildSync({ entryPoints: [path.join(root, 'tools/theme-audit-colors.mjs')],
  bundle: true, packages: 'external', write: false, platform: 'node', format: 'cjs' });
const auditModule = { exports: {} as Record<string, unknown> };
new Function('module', 'exports', 'require', compiled.outputFiles[0]!.text)(auditModule, auditModule.exports, require);
const audit = auditModule.exports as {
  themes: [string, string][];
  tokensFor: (theme: string) => Record<string, string>;
  measure: (css: string, body: string, tokens: Record<string, string>) => Array<{ selector: string; ratio: number; foreground: number[] }>;
};

describe('probe', () => {
  it('shows what the home rules measure', () => {
    const { readFileSync } = require('node:fs');
    const standard = readFileSync(path.join(root, 'shared/src/field-standards.ts'), 'utf8');
    const tokens = audit.tokensFor('light');
    const css = `.fm-home .lead{color:#767676;}` +
      `.fm-home .entry > span{color:var(--muted);}` +
      `.lead{color:#767676;}` +
      `body{background:${tokens['--vscode-editor-background']};color:${tokens['--vscode-foreground']}}`;
    const body = '<div class="fm-home"><p class="lead">Start here.</p>'
      + '<div class="entry"><span>Choose a starter.</span></div></div>';
    const records = audit.measure(css, body, tokens);
    writeFileSync('/workspace/.fm-artifacts/probe-measure.txt',
      JSON.stringify(records, null, 1) + '\n\nstandard has muted: ' + standard.includes('--muted') + '\n');
    expect(records.length).toBeGreaterThan(0);
  });
});
