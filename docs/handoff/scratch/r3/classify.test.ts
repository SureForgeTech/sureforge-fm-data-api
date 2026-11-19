import { describe, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { suggestPromptFields as before } from '/workspace/.fm-scratch/mine/fmWebPromptDraft.original';
import { suggestPromptFields as after } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/services/fmWebPromptDraft';

type Field = { name: string };
const simple: Field[] = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Company' }];

interface Res { fields: Array<{ field: { name: string }; required?: boolean }>; unmatched: string[] }
const run = (fn: typeof before, prompt: string): Res => {
  try { return fn(prompt, simple as never); }
  catch { return { fields: [], unmatched: [] }; }
};
const names = (r: Res) => r.fields.map((f) => f.field.name).sort().join(',');

const raw = readFileSync('/workspace/.fm-scratch/r3/diff-old-new.txt', 'utf8').split('\n');
const prompts: string[] = [];
for (const line of raw) {
  if (line.startsWith('"') && line.trimEnd().endsWith('."')) {
    try { prompts.push(JSON.parse(line.trimEnd().slice(0, -2) + '"')); } catch { /* skip */ }
  }
}

describe('classify', () => {
  it('buckets old/new differences', () => {
    const lost: string[] = [];      // old had a field, new does not
    const gained: string[] = [];    // new has a field old did not
    const reqChanged: string[] = [];
    const unmatchedLost: string[] = [];
    for (const prompt of prompts) {
      const b = run(before, prompt);
      const a = run(after, prompt);
      const bn = new Set(b.fields.map((f) => f.field.name));
      const an = new Set(a.fields.map((f) => f.field.name));
      const lostNames = [...bn].filter((n) => !an.has(n));
      const gainedNames = [...an].filter((n) => !bn.has(n));
      const lostUnmatched = b.unmatched.filter((u) => !a.unmatched.includes(u));
      const gainedUnmatched = a.unmatched.filter((u) => !b.unmatched.includes(u));
      let reqDiff = '';
      for (const f of a.fields) {
        const old = b.fields.find((x) => x.field.name === f.field.name);
        if (old && (old.required === true) !== (f.required === true)) reqDiff = `${f.field.name}:${old.required ?? null}->${f.required ?? null}`;
      }
      const line = `${JSON.stringify(prompt)} | old=[${names(b)}] new=[${names(a)}] oldU=[${b.unmatched}] newU=[${a.unmatched}]`;
      if (lostNames.length) lost.push(`LOST   ${lostNames.join('+')} | ${line}`);
      if (gainedNames.length) gained.push(`GAINED ${gainedNames.join('+')} | ${line}`);
      if (reqDiff) reqChanged.push(`REQ ${reqDiff} | ${line}`);
      if (lostUnmatched.length) unmatchedLost.push(`UMLOST ${lostUnmatched.join('+')} | ${line}`);
      if (gainedUnmatched.length) unmatchedLost.push(`UMGAIN ${gainedUnmatched.join('+')} | ${line}`);
    }
    writeFileSync('/workspace/.fm-scratch/r3/cls-lost.txt', lost.join('\n') + '\n');
    writeFileSync('/workspace/.fm-scratch/r3/cls-gained.txt', gained.join('\n') + '\n');
    writeFileSync('/workspace/.fm-scratch/r3/cls-req.txt', reqChanged.join('\n') + '\n');
    writeFileSync('/workspace/.fm-scratch/r3/cls-unmatched.txt', unmatchedLost.join('\n') + '\n');
  });
});
