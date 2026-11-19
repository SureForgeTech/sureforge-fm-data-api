import { describe, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { suggestPromptFields } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/services/fmWebPromptDraft';

const simple = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Company' }];
const show = (prompt: string): string => {
  const r = suggestPromptFields(prompt, simple as never);
  return JSON.stringify({ fields: r.fields.map((f) => [f.field.name, f.required ?? null]), unmatched: r.unmatched });
};

const CASES = [
  // requirement scope across a list
  'Require name, email, and phone.',
  'Require name, email and phone.',
  'Require email and notes.',
  'Require email, and notes.',
  'Require email, notes.',
  'Require email, exclude phone, and notes.',
  'Require email, exclude phone, notes.',
  "Require email, don't include phone, and notes.",
  "Require email, don't include phone, notes.",
  'Require email, but exclude phone, and notes.',
  'Require email and notes, exclude phone.',
  'Require email. Require notes.',
  'Require email and optional notes.',
  'Require email and optional notes and company.',
  // postfix exclusions
  'Include email, phone excluded.',
  'Include email and phone omitted.',
  'Form with phone excluded.',
  'Form that leaves out phone.',
  'Include email, leave out phone.',
  'Include email, left out phone.',
  'Include email, leaving out phone.',
  // "everything but"
  'Include everything but phone.',
  'Include all but phone.',
  'Include everything except phone.',
  // optional via verb
  'Do not require phone.',
  'Do not require phone and include email.',
  'Include email, do not require phone.',
  'Make phone optional, include email.',
  'Phone optional, include email.',
  'Phone is optional.',
  // not + required variants
  'Include email but not required phone.',
  'Include email but not at all required phone.',
  'Include email but not mandatory phone.',
  'Include email but not necessary phone.',
  'Include email but not really required phone.',
  'Include email but not strictly required phone.',
  'Include email but not required phone and not optional company.',
  // emphatic
  'Include not only email but also phone.',
  'Do not only email but also phone.',
  'Do not just email, include phone.',
  'Include email, not only phone but also notes.',
  // titles
  'Make a form with email.',
  'Create a form with email.',
  'Build a form with email.',
  'Make a registration form.',
  'Create a registration form with email and notes.',
  'Make a form for the workshop with email.',
  'Draft a form for the workshop with email.',
  'Make a form.',
  'Create a form.'
];

describe('focus', () => {
  it('dumps', () => {
    const out = CASES.map((p) => `${JSON.stringify(p)}\n    ${show(p)}`).join('\n');
    writeFileSync('/workspace/.fm-scratch/r3/focus-out.txt', out + '\n');
  });
});
