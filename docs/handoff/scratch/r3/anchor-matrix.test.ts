import { describe, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { suggestPromptFields } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/services/fmWebPromptDraft';

const simple = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Company' }];

type Head = { text: string; neg: boolean };
const HEADS: Head[] = [
  { text: 'Include email', neg: false },
  { text: "Don't include email", neg: true },
  { text: 'Require email', neg: false },
  { text: 'Exclude email', neg: true }
];
type Mid = { text: string; neg: boolean; reversal: boolean };
const MIDS: Mid[] = [
  { text: ", don't include phone", neg: true, reversal: false },
  { text: ', exclude phone', neg: true, reversal: false },
  { text: ', but include phone', neg: false, reversal: true },
  { text: ', include phone', neg: false, reversal: false },
  { text: ', but don\'t include phone', neg: true, reversal: true }
];
const TAILS = [', and notes', ' and notes', ', notes', ', and company', ' and notes and company'];

describe('anchor matrix', () => {
  it('checks the list-anchor rule over the head x mid x tail matrix', () => {
    const rows: string[] = [];
    for (const head of HEADS) for (const mid of MIDS) for (const tail of TAILS) {
      const prompt = `${head.text}${mid.text}${tail}.`;
      const r = suggestPromptFields(prompt, simple);
      const got = r.fields.map((f) => f.field.name);
      const req = r.fields.map((f) => [f.field.name, f.required ?? null] as [string, boolean | null]);
      // Rule: a coordinated item takes the anchor's polarity. The anchor is the list head
      // and moves to a clause that ends positive; an explicit reversal carries the items after it.
      const expectedTailPositive = head.neg && mid.neg && !mid.reversal ? false : true;
      const tailNames = tail.includes('notes') ? ['Notes'] : [];
      const tailIncluded = tailNames.every((n) => got.includes(n));
      const tailPos = tailIncluded;
      const ok = tailPos === expectedTailPositive;
      rows.push(`${ok ? 'OK  ' : 'FAIL'} tail=${expectedTailPositive ? 'pos' : 'neg'} got=[${got.join(',')}] req=${JSON.stringify(req)} | ${JSON.stringify(prompt)}`);
    }
    writeFileSync('/workspace/.fm-scratch/r3/anchor-matrix.txt', rows.join('\n') + '\n');
  });
});
