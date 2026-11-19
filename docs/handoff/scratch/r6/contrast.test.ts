import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildSync } from 'esbuild';
import { describe, expect, it } from 'vitest';

const OUT = '/workspace/.fm-scratch/r6/contrast-out.txt';
const lines: string[] = [];
function log(line: string): void {
  lines.push(line);
  require('node:fs').writeFileSync(OUT, lines.join('\n') + '\n');
}

const root = '/workspace/sureforge-fm-data-api-wt-home';
const requireFromExtension = createRequire(path.join(root, 'extension', 'package.json'));

interface ThemeAudit {
  disposeAudit: () => void;
  themes: [string, string][];
  tokensFor: (theme: string) => Record<string, string>;
  resolvedCss: (css: string, tokens: Record<string, string>, missing?: string[]) => string;
  measure: (css: string, body: string, tokens: Record<string, string>, excluded?: unknown[]) => { selector: string; ratio: number; foreground: number[] }[];
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

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function luminance(rgb: number[]): number {
  return 0.2126 * srgbToLinear(rgb[0]) + 0.7152 * srgbToLinear(rgb[1]) + 0.0722 * srgbToLinear(rgb[2]);
}
function contrast(a: number[], b: number[]): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
function hex(value: string): number[] {
  const m = /^#?([0-9a-f]{6,8})$/i.exec(value.trim());
  if (!m) throw new Error(`not a hex colour: ${value}`);
  const n = parseInt(m[1].slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function blend(fg: number[], bg: number[], alpha: number): number[] {
  return fg.map((channel, index) => alpha * channel + (1 - alpha) * bg[index]);
}

describe('r6 contrast probe', () => {
  it('does jsdom apply opacity from a class rule? (does the repo audit see it?)', () => {
    const jsdom = requireFromExtension('jsdom');
    const dom = new jsdom.JSDOM(
      '<html><head><style>.lead { opacity: 0.8; color: rgb(97,97,97); } .plain { color: rgb(97,97,97); }</style></head>' +
        '<body><p class="lead">Lead</p><p class="plain">Plain</p></body></html>'
    );
    const doc = dom.window.document;
    const lead = doc.querySelector('.lead')!;
    const plain = doc.querySelector('.plain')!;
    log(
      `jsdom computed opacity for .lead = ${dom.window.getComputedStyle(lead).opacity}; ` +
        `for .plain = ${dom.window.getComputedStyle(plain).opacity}; ` +
        `lead color = ${dom.window.getComputedStyle(lead).color}; plain color = ${dom.window.getComputedStyle(plain).color}`
    );
    expect(dom.window.getComputedStyle(lead).color).toBe('rgb(97, 97, 97)');
  });

  it('computes the real contrast of the home secondary text, with opacity applied', () => {
    const homeCss = readFileSync(path.join(root, 'extension/src/webviews/home/ui/styles.css'), 'utf8');
    // The opacity the home applies to each secondary run.
    const cases: Array<[string, number]> = [
      ['.lead (opacity 0.8)', 0.8],
      ['.entry > span (opacity 0.75)', 0.75],
      ['section > p (opacity 0.8)', 0.8],
      ['.fm-version (opacity 0.6)', 0.6]
    ];
    for (const theme of audit.themes.map(([name]) => name)) {
      const tokens = audit.tokensFor(theme);
      const fg = hex(tokens['--vscode-foreground']!);
      const bg = hex(tokens['--vscode-editor-background']!);
      log(`${theme}: --vscode-foreground=${tokens['--vscode-foreground']} --vscode-editor-background=${tokens['--vscode-editor-background']}`);
      log(`${theme}: base foreground contrast = ${contrast(fg, bg).toFixed(2)}`);
      for (const [label, alpha] of cases) {
        const faded = blend(fg, bg, alpha);
        const ratio = contrast(faded, bg);
        log(`${theme}: ${label} -> rgb(${faded.map(Math.round).join(',')}) contrast = ${ratio.toFixed(2)} ${ratio >= 4.5 ? 'PASS' : 'FAIL(<4.5)'}`);
      }
      // What environmentCompare does for the same kind of secondary text.
      const desc = tokens['--vscode-descriptionForeground'];
      if (desc) {
        const mixed = blend(hex(desc), fg, 0.75);
        log(`${theme}: control descriptionForeground 75% mix -> rgb(${mixed.map(Math.round).join(',')}) contrast = ${contrast(mixed, bg).toFixed(2)}`);
      }
    }
    // Prove the stylesheet really carries those opacities.
    for (const [, alpha] of cases) {
      expect(homeCss).toContain(`opacity: ${alpha}`);
    }
  });
});
