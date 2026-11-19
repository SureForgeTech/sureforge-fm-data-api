import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { suggestPromptFields } from '/workspace/.fm-scratch/r4/prev';

const F = [
  { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Name' }, { name: 'Company' },
  { name: 'First Name' }, { name: 'Last Name' }, { name: 'Session' }, { name: 'Accessibility Notes' },
  { name: 'Dietary Requirements' }, { name: 'Count', kind: 'calculation' }, { name: 'Badge', kind: 'global' }
];
const prompts: string[] = [
  'Require email, notes not required.', 'Require email, notes not optional.', 'Require email, phone not required, and notes.',
  'Require email, phone not required and notes.', 'Require email and notes, phone not required.', 'Require email, notes are not required.',
  'Require email, notes not required, and company.', 'Require email, don\'t include phone, notes not required.',
  'Require email, don\'t include phone, notes not required, and company.', 'Require email, don\'t include phone or notes.',
  'Require email, don\'t include phone, or notes.', 'Include email, don\'t include phone, or notes.', 'Include email, don\'t include phone or notes.',
  'Don\'t include phone, or notes.', 'Require email, not phone, or notes.', 'Require email, not phone or notes.',
  'Require email, phone optional, notes not required.', 'Require email, phone optional and notes.', 'Require email, phone optionally, and notes.',
  'Require email, notes optional.', 'Require email, notes optional, and company.', 'Require email, notes not required, phone required.',
  'Require email, notes not necessary.', 'Require email, phone not mandatory, and notes.', 'Require email, phone not required, or notes.',
];
it('cases', () => {
  const out: string[] = [];
  for (const p of prompts) {
    const r = suggestPromptFields(p, F);
    out.push(`${p}\n  title=${JSON.stringify(r.title)}\n  fields=${JSON.stringify(r.fields.map(f => [f.field.name, f.required]))}\n  unmatched=${JSON.stringify(r.unmatched)}`);
  }
  writeFileSync('/workspace/.fm-scratch/r4/prev3.txt', out.join('\n'));
});
