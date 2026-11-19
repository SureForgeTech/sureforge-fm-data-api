/**
 * Independent reviewer scratch check, part 5 for PR #579:
 *  the computed style of a home entry button, with the shared screen stylesheet in place.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { buildSync } from 'esbuild';
import { describe, expect, it } from 'vitest';

const EXT = '/workspace/sureforge-fm-data-api-wt-home/extension';
const REPO = '/workspace/sureforge-fm-data-api-wt-home';

const log: string[] = [];
const note = (line: string): void => {
  log.push(line);
  writeFileSync('/workspace/.fm-scratch/r8/result5.txt', log.join('\n') + '\n');
};

const require = createRequire(path.join(EXT, 'package.json'));
const { JSDOM } = require('jsdom') as { JSDOM: new (html: string, options: unknown) => { window: any } };

function standardFieldsCss(): string {
  const compiled = buildSync({
    entryPoints: [path.join(REPO, 'shared/src/field-standards.ts')],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs'
  });
  const module = { exports: {} as { standardFieldsCss: (webview?: boolean) => string } };
  new Function('module', compiled.outputFiles[0]!.text)(module);
  return module.exports.standardFieldsCss(true);
}

describe('the computed style of a home entry button', () => {
  it('shows what the shared screen stylesheet contributes', () => {
    const shared = standardFieldsCss();
    const home = readFileSync(path.join(EXT, 'src/webviews/home/ui/styles.css'), 'utf8');
    const html =
      '<!DOCTYPE html><html><head><style>' +
      shared +
      '</style><style>' +
      home +
      '</style></head><body class="fm-page fm-home">' +
      '<section><h2>Build a Web App</h2><p>Make a web form.</p>' +
      '<div class="entry"><button type="button" data-command="x">Create FM Web App</button>' +
      '<span>Choose a starter.</span></div></section></body></html>';

    const dom = new JSDOM(html, { pretendToBeVisual: true });
    const button = dom.window.document.querySelector('button[data-command]');
    const span = dom.window.document.querySelector('.entry span');
    const entry = dom.window.document.querySelector('.entry');
    const style = dom.window.getComputedStyle(button);
    note(`J1 button align-self: ${style.alignSelf}`);
    note(`J2 entry align-items: ${dom.window.getComputedStyle(entry).alignItems}`);
    note(`J3 span align-self: ${dom.window.getComputedStyle(span).alignSelf}`);
    note(`J4 button background: ${style.backgroundColor} / color ${style.color}`);
    note(`J5 shared button rule present: ${shared.includes('align-self: center')}`);
    expect(style).toBeDefined();
  });
});
