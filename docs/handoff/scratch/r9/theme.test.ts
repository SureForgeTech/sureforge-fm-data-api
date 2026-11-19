import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = '/workspace/sureforge-fm-data-api-wt-home';
const OUT = '/workspace/.fm-scratch/r9/theme-contrast.json';

describe('independent home contrast measurement', () => {
  it('measures the home stylesheet in every audited theme', async () => {
    const audit = await import(path.join(root, 'tools/theme-audit-colors.mjs'));
    const homeCss = readFileSync(path.join(root, 'extension/src/webviews/home/ui/styles.css'), 'utf8');
    const body = '<div class="fm-home"><p class="lead">Start here. Everything else is under Advanced Tools.</p>'
      + '<section><h2>Build a Web App</h2><p>Make a web form that writes to FileMaker.</p>'
      + '<div class="entry"><button type="button">Create FM Web App</button><span>Choose a starter.</span></div></section></div>';

    const report: Record<string, unknown> = {};
    for (const [theme] of audit.themes as [string, string][]) {
      const tokens = audit.tokensFor(theme);
      const pairs = audit.measure(homeCss, body, tokens);
      report[theme] = {
        pairs: pairs.map((p: { selector: string; ratio: number }) => ({ selector: p.selector, ratio: Number(p.ratio.toFixed(3)) })),
        below45: pairs.filter((p: { ratio: number }) => p.ratio < 4.5).length,
        min: Number(Math.min(...pairs.map((p: { ratio: number }) => p.ratio)).toFixed(3))
      };
      audit.disposeAudit();
    }
    writeFileSync(OUT, JSON.stringify(report, null, 2));
    for (const [theme, value] of Object.entries(report) as [string, { below45: number; min: number }][]) {
      expect(value.below45, `${theme} min ratio ${value.min}`).toBe(0);
    }
  });
});
