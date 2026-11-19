import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = '/workspace/sureforge-fm-data-api-wt-home';
const OUT = '/workspace/.fm-scratch/r9/theme-contrast-full.json';

describe('home contrast over the real rendered markup', () => {
  it('measures every text node of the real home page in every audited theme', async () => {
    const audit = await import(path.join(root, 'tools/theme-audit-colors.mjs'));
    const { standardFieldsCss } = await import(path.join(root, 'shared/dist/field-standards.js'));
    const homeCss = readFileSync(path.join(root, 'extension/src/webviews/home/ui/styles.css'), 'utf8');
    const catalogue = readFileSync(path.join(root, 'extension/src/webviews/home/catalogue.ts'), 'utf8');

    // Rebuild the exact body the panel renders, from the real catalogue.
    const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const sectionHtml = (blocks: string[]) =>
      blocks
        .map((b) => {
          const label = /label:\s*'((?:[^'\\]|\\.)*)'/.exec(b)?.[1] ?? '';
          const desc = /description:\s*'((?:[^'\\]|\\.)*)'/.exec(b)?.[1] ?? '';
          const cmd = /command:\s*'([^']+)'/.exec(b)?.[1] ?? '';
          return `<div class="entry"><button type="button" data-command="${esc(cmd)}">${esc(label)}</button><span>${esc(desc)}</span></div>`;
        })
        .join('');
    const groupHtml = (id: string) => {
      const start = catalogue.indexOf(`id: '${id}'`);
      const end = catalogue.indexOf('entries: [', start);
      const block = catalogue.slice(end, catalogue.indexOf(']', catalogue.indexOf('command:', end)));
      return sectionHtml(block.split(/\n  \{/).filter((x) => x.includes('command:')));
    };
    const body = '<div class="fm-home"><h1>FileMaker</h1><p class="lead">Start here. Everything else is under Advanced Tools.</p>'
      + `<section><h2>Build a Web App</h2><p>Make a web form that writes to FileMaker, without editing code or JSON.</p>${groupHtml('build')}</section>`
      + `<section><h2>Connect and Test</h2><p>Reach your FileMaker server and find out why a connection does not work.</p>${groupHtml('connect')}</section>`
      + `<section><h2>Browse Data</h2><p>Find, read and change records in the database you connected to.</p>${groupHtml('browse')}</section>`
      + `<section><h2>Help</h2><p>Guided setup, the manual, and what the extension is doing.</p>${groupHtml('help')}</section>`
      + '<details><summary><strong>Advanced Tools</strong></summary>'
      + `<section><h2>Setup</h2><p>Project setup and the settings that shape what the extension may do.</p>${groupHtml('advanced-setup')}</section>`
      + '</details>'
      + '<footer class="fm-version">FileMaker Data API Tools v1.9.1</footer></div>';

    const css = standardFieldsCss(true) + '\n' + homeCss;
    const report: Record<string, unknown> = {};
    for (const [theme] of audit.themes as [string, string][]) {
      const tokens = audit.tokensFor(theme);
      const pairs = audit.measure(css, body, tokens);
      report[theme] = {
        measuredPairs: pairs.length,
        min: Number(Math.min(...pairs.map((p: { ratio: number }) => p.ratio)).toFixed(3)),
        below45: pairs
          .filter((p: { ratio: number }) => p.ratio < 4.5)
          .map((p: { selector: string; ratio: number }) => ({ selector: p.selector, ratio: Number(p.ratio.toFixed(3)) }))
      };
      audit.disposeAudit();
    }
    writeFileSync(OUT, JSON.stringify({ body, report }, null, 2));
    for (const [theme, value] of Object.entries(report) as [string, { below45: unknown[]; min: number }][]) {
      expect(value.below45, `${theme} min ratio ${value.min}`).toEqual([]);
    }
  });
});
