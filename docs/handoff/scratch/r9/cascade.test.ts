import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO = '/workspace/sureforge-fm-data-api-wt-home';
const OUT = '/workspace/.fm-scratch/r9/cascade-result.json';

type Row = {
  source: string;
  selector: string;
  specificity: string;
  order: number;
  alignSelf: string;
};

const results: Record<string, unknown> = {};

function gitShow(ref: string, file: string): string {
  return execFileSync('git', ['-C', REPO, 'show', `${ref}:${file}`], { encoding: 'utf8' });
}

/** Rebuild the shipped shared stylesheet exactly as extension/scripts/copy-webviews.mjs does. */
async function sharedStandardsCss(): Promise<string> {
  const { build } = await import(path.join(REPO, 'node_modules/esbuild/lib/main.js'));
  const built = await build({
    entryPoints: [path.join(REPO, 'shared/src/field-standards.ts')],
    bundle: true,
    platform: 'browser',
    format: 'esm',
    write: false
  });
  const moduleText = built.outputFiles[0].text;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(moduleText).toString('base64')}`;
  const mod = await import(dataUrl);
  return mod.standardFieldsCss(true) as string;
}

function specificity(selector: string): string {
  // Count ids, classes/attributes/pseudo-classes, elements/pseudo-elements for one compound selector.
  const ids = (selector.match(/#[\w-]+/g) ?? []).length;
  const classes = (selector.match(/\.[\w-]+/g) ?? []).length
    + (selector.match(/\[[^\]]+\]/g) ?? []).length
    + (selector.replace(/:(?!:)[a-z-]+(\([^)]*\))?/gi, ' ').match(/:(?!:)[a-z-]+/gi) ?? []).length;
  const elements = (selector
    .replace(/#[\w-]+/g, ' ')
    .replace(/\.[\w-]+/g, ' ')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/:(?!:)[a-z-]+(\([^)]*\))?/gi, ' ')
    .match(/(^|[\s>+~])([a-z][\w-]*)/gi) ?? []).length;
  return `${ids}.${classes}.${elements}`;
}

function compare(a: Row, b: Row): number {
  const [ai, ac, ae] = a.specificity.split('.').map(Number);
  const [bi, bc, be] = b.specificity.split('.').map(Number);
  if (ai !== bi) return ai - bi;
  if (ac !== bc) return ac - bc;
  if (ae !== be) return ae - be;
  return a.order - b.order;
}

describe('F2: the home button align-self cascade', () => {
  it('computes the cascade over the real stylesheets and the real home markup', async () => {
    const { JSDOM } = await import(path.join(REPO, 'node_modules/jsdom/lib/api.js'));
    const { FileMakerHomePanel } = await import(path.join(REPO, 'extension/src/webviews/home/index.ts'));
    const vscode = await import('vscode');

    let html = '';
    (vscode as any).window.createWebviewPanel.mockImplementation((_type: string, _title: string, _col: unknown, _opts: unknown) => ({
      webview: {
        html: '',
        cspSource: 'vscode-resource:',
        asWebviewUri: (uri: unknown) => String(uri),
        onDidReceiveMessage: () => undefined,
        postMessage: async () => true
      },
      reveal: () => undefined,
      onDidDispose: () => undefined,
      dispose: () => undefined
    }));
    FileMakerHomePanel.createOrShow({ extensionUri: { fsPath: '/extension' } } as never);
    const panels = (vscode as any).window.createWebviewPanel.mock.results;
    html = panels[panels.length - 1].value.webview.html as string;

    const sharedCss = await sharedStandardsCss();
    const headHomeCss = readFileSync(path.join(REPO, 'extension/src/webviews/home/ui/styles.css'), 'utf8');
    const beforeHomeCss = gitShow('ee671e9', 'extension/src/webviews/home/ui/styles.css');

    const compute = (homeCss: string, label: string) => {
      // Replace the two <link> elements with inline <style> elements, in the same document order.
      const cssText = sharedCss + '\n' + homeCss;
      const page = html
        .replace(/<link rel="stylesheet"[^>]*>/g, '')
        .replace('</head>', `<style>${sharedCss}</style><style>${homeCss}</style></head>`);
      const dom = new JSDOM(page, { url: 'https://panel.invalid/' });
      const doc = dom.window.document;
      const button = doc.querySelector('button[data-command]') as any;
      const rows: Row[] = [];
      let order = 0;
      const sheets = doc.styleSheets as any;
      for (let s = 0; s < sheets.length; s += 1) {
        const sheet = sheets[s];
        const rules = sheet.cssRules as any;
        for (let r = 0; r < rules.length; r += 1) {
          const rule = rules[r];
          if (!rule.selectorText) continue;
          for (const selector of rule.selectorText.split(',').map((s: string) => s.trim())) {
            let matches = false;
            try {
              matches = button.matches(selector);
            } catch {
              matches = false;
            }
            if (!matches) continue;
            const alignSelf = rule.style.getPropertyValue('align-self');
            if (alignSelf === '') continue;
            rows.push({
              source: label,
              selector,
              specificity: specificity(selector),
              order: order++,
              alignSelf
            });
          }
        }
      }
      const winner = rows.slice().sort(compare).pop();
      let computed = '';
      try {
        computed = dom.window.getComputedStyle(button).getPropertyValue('align-self');
      } catch (error) {
        computed = `error: ${String(error)}`;
      }
      return { rows, winner, computed };
    };

    const after = compute(headHomeCss, 'head 40a56eb');
    const before = compute(beforeHomeCss, 'before ee671e9');

    results.sharedCssHasAlignSelfCenter = /(^|[;{\s])align-self:\s*center/.test(sharedCss);
    results.sharedAlignSelfMatches = sharedCss.match(/[^{}]*\{[^{}]*align-self:\s*center[^{}]*\}/g) ?? [];
    results.after = after;
    results.before = before;
    results.htmlLength = html.length;
    results.buttonSelectorFound = /button data-command="filemakerDataApiTools.createFmWebApp"/.test(html);
    results.htmlSnippet = html.slice(html.indexOf('<body'), html.indexOf('<body') + 700);

    writeFileSync(OUT, JSON.stringify(results, null, 2));

    expect(after.rows.length).toBeGreaterThan(0);
    expect(after.winner?.alignSelf).toBe('flex-start');
    expect(before.winner?.alignSelf).toBe('center');
  });
});
