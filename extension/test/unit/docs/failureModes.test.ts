import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';

const root = path.resolve(__dirname, '../../../..');

it('every backtick file reference in the failure-mode catalogue exists', () => {
  const document = readFileSync(path.join(root, 'docs/FILEMAKER_FAILURE_MODES.md'), 'utf8');
  const paths = Array.from(document.matchAll(/`([^`\n]+)`/g), (match) => match[1]!)
    .filter((value) => !value.includes('://'))
    .map((value) => /^([\w./-]+\.(?:ts|js|mjs|md|json|css|html|txt))(?::[\d, -]+)?$/.exec(value)?.[1])
    .filter((value): value is string => value !== undefined);
  expect(paths.length).toBeGreaterThan(0);
  for (const file of new Set(paths)) {
    // Older certificate rows retain extension/src-relative and short service / utility paths.
    const bases = ['', 'extension/src', 'extension/src/services', 'extension/src/utils', 'extension/src/webviews', 'extension'];
    expect(bases.some((base) => existsSync(path.join(root, base, file))), file).toBe(true);
  }
});

it('keeps the no-match troubleshooting row to four cells, including the empty-page count advice', () => {
  const document = readFileSync(path.join(root, 'docs/FILEMAKER_FAILURE_MODES.md'), 'utf8');
  const row = document.split('\n').find((line) => line.startsWith('| A find shows nothing |'))!;
  const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
  expect(cells).toHaveLength(4);
  expect(cells[2]).toContain('empty page');
  expect(cells[2]).toContain('supplied match count');
});

/** The one row in the catalogue that starts with the given prefix. */
function onlyRow(document: string, prefix: string): string {
  const rows = document.split('\n').filter((line) => line.startsWith(prefix));
  expect(rows, `the catalogue should have exactly one row starting with "${prefix}"`).toHaveLength(1);
  return rows[0]!;
}

it('records the CA-file re-check as fixed, in the row and in the summary', () => {
  const document = readFileSync(path.join(root, 'docs/FILEMAKER_FAILURE_MODES.md'), 'utf8');
  const row = onlyRow(document, '| N6 |');
  expect(row).toContain('**Fixed');
  // The message the agent build now gives, and the work the row used to leave open.
  expect(row).toContain('does not contain a certificate');
  expect(row).toContain('re-checked when the agent is built');
  expect(row).not.toMatch(/ends? in the misleading/);
  expect(row).not.toContain('Re-check at agent build');
  // The summary table called N6 fixed already; the detail row must say the same.
  const summary = onlyRow(document, '| N1, N2, N4, N6 |');
  expect(summary).toContain('**Fixed');
  // The scenario row must not still describe the old behaviour.
  const scenario = onlyRow(document, '| 1.27 |');
  expect(scenario).toContain('does not contain a certificate');
  expect(scenario).toContain('re-checked when the agent is built');
  expect(scenario).not.toMatch(/ends? in the misleading/);
});

it('uses the current AI append button and records the owner-supplied real-server omit finding', () => {
  const guide = readFileSync(path.join(root, 'extension/docs/USER_GUIDE.md'), 'utf8');
  expect(guide).toContain('if you choose **Add to the file**, appends');
  for (const document of [guide, readFileSync(path.join(root, 'docs/FILEMAKER_FAILURE_MODES.md'), 'utf8')]) {
    expect(document).toContain('{"Last Name":"==Smith","omit":"true"}');
    expect(document).toMatch(/empty find.*code 400/i);
  }
});
