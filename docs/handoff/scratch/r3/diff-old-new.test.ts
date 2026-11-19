import { describe, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { suggestPromptFields as before } from '/workspace/.fm-scratch/mine/fmWebPromptDraft.original';
import { suggestPromptFields as after } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/services/fmWebPromptDraft';

type Field = { name: string; kind?: string; required?: boolean };
const simple: Field[] = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Company' }];

const show = (r: { fields: Array<{ field: { name: string }; required?: boolean }>; unmatched: string[]; title?: string }) =>
  JSON.stringify({
    fields: r.fields.map((f) => [f.field.name, f.required ?? null]),
    unmatched: r.unmatched
  });

const run = (fn: typeof before, prompt: string) => {
  try { return show(fn(prompt, simple as never)); }
  catch (error) { return 'THREW:' + (error as Error).message; }
};

// Systematic corpus: every combination of {list head} x {mid item} x {tail item}
const HEADS = ['', 'Include ', 'Require ', 'Don\'t include ', 'Do not include ', 'Exclude ', 'Never collect ', 'Skip ', 'Omit ', 'Without '];
const MIDS = ['', ' but not ', ' but don\'t include ', ', don\'t include ', ', but don\'t include ', ', exclude ', ' and don\'t include ', ' or don\'t include ', ', not '];
const TAILS = ['', ' and notes', ', notes', ' and company', ', and company', ' but include notes', ', but include notes', ' and phone'];
const ITEMS = ['email', 'phone', 'notes', 'company', 'name'];

const PROMPTS = new Set<string>();
for (const h of HEADS) for (const m of MIDS) for (const t of TAILS) {
  for (const a of ITEMS) for (const b of ITEMS) {
    if (a === b) continue;
    PROMPTS.add(`${h}${a}${m}${b}${t}.`);
  }
}
// Explicit not / required / optional / emphatic forms
for (const a of ITEMS) for (const b of ITEMS) {
  if (a === b) continue;
  for (const tpl of [
    'Include {a} but not {b}.',
    'Include {a}, not {b}.',
    'Require {a}, but not {b}.',
    'Include {a} but not required {b}.',
    'Include {a} but not optional {b}.',
    'Include {a}, {b} is not required.',
    'Include {a} and {b} is not optional.',
    'Do not require {b}. Include {a}.',
    'Do not include {b}, include {a}.',
    'Exclude {b}, include {a}.',
    'Include not only {a} but also {b}.',
    'Do not include {b}, but include {a}.',
    'Include {a}, but exclude {b}.',
    'Include {a}, and not {b}.',
    'Include {a} except {b}.',
    'Include {a} without {b}.',
    'Include {a}, leaving out {b}.'
  ]) PROMPTS.add(tpl.replace('{a}', a).replace('{b}', b));
}

describe('differential r3', () => {
  it('reports every old/new difference over the generated corpus', () => {
    const diffs: string[] = [];
    for (const prompt of PROMPTS) {
      const b = run(before, prompt);
      const a = run(after, prompt);
      if (a !== b) diffs.push(`${JSON.stringify(prompt)}\n  before: ${b}\n  after:  ${a}`);
    }
    writeFileSync('/workspace/.fm-scratch/r3/diff-old-new.txt', `PROMPTS: ${PROMPTS.size}, DIFFERENCES: ${diffs.length}\n` + diffs.join('\n') + '\n');
  });
});
