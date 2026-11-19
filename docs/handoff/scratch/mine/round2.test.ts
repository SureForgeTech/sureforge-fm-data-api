import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { suggestPromptFields as before } from '/workspace/.fm-scratch/fmWebPromptDraft.original';
import { suggestPromptFields as after } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/services/fmWebPromptDraft';

type Field = { name: string; kind?: string; required?: boolean };
const LAYOUT: Field[] = [{ name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Name' }];

const CASES: string[] = [
  // R1: emphatic inclusion must not read as an exclusion.
  'Include not only email but also phone.',
  'Include all the fields, not just email.',
  'Include email, not only phone but also notes.',
  // R2: an explicit mid-list reversal must carry the following items with it.
  "Don't include phone, but include email, and notes.",
  "Don't include phone but include email and notes.",
  // R3: an adverb between "not" and the qualifier word.
  'Include email and not strictly required phone.',
  // R4: exclusion vocabulary.
  'Make a form that excludes phone and includes email.',
  'Create a form that omits phone. Include email.',
  'Draft a registration form leaving out phone, including email.',
  'Include everything except phone and email.',
  // Previously verified behaviour that must not move.
  'Include email but not phone.',
  "Include email, don't include phone, and notes.",
  "Don't include phone, notes.",
  'Exclude phone, company, and notes.',
  'Require name, email, and phone.',
];

const names = (r: { fields: Array<{ field: { name: string }; required?: boolean }>; unmatched: string[] }) =>
  JSON.stringify({ fields: r.fields.map((f) => [f.field.name, f.required ?? null]), unmatched: r.unmatched });

describe('review round 2 findings: current head vs the pre-fix parser', () => {
  it('records the current behaviour for every round-2 case', () => {
    const out: string[] = [];
    for (const prompt of CASES) {
      out.push(`${JSON.stringify(prompt)}\n  old: ${names(before(prompt, LAYOUT as never))}\n  new: ${names(after(prompt, LAYOUT as never))}`);
    }
    writeFileSync('/workspace/.fm-artifacts/round2-cases.txt', out.join('\n') + '\n');
    expect(out.length).toBe(CASES.length);
  });
});
