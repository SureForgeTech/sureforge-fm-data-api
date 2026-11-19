import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { suggestPromptFields } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/services/fmWebPromptDraft';

const F = [
  { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Name' }, { name: 'Company' },
  { name: 'First Name' }, { name: 'Last Name' }, { name: 'Session' }, { name: 'Accessibility Notes' },
  { name: 'Dietary Requirements' }, { name: 'Count', kind: 'calculation' }, { name: 'Badge', kind: 'global' }
];
const prompts: string[] = [
  'Include email and phone. Leave out phone.', 'Include email, leave out phone.', 'Include email and drop phone.', 'Include email, remove phone.',
  'Include email, without phone.', 'Include email, no phone.', 'Include email, exclude phone.', 'Include email, do not ask for phone.',
  'Include email, no need for phone.', 'Include email, I dont want phone.', 'Include email, minus phone.', 'Include email, not wanted phone.',
  'Include email, phone excluded.', 'Include email, skip the phone field.', 'Include email, and leave phone out.',
  'Require email, leave out phone, and notes.', 'Include email. Leave out phone and notes.', 'Include email and notes, but leave out phone.',
  'Make a form with email and notes, excluding phone.', 'Include email; leave out phone; include notes.',
  'Make an A Team form with email.', 'Build an A and B form with email.', 'Create the A-Team form with email.', 'Build the An Evening form with email.',
  'Create a form for the A Team form with email.', 'Create the Art form with email.',
  'Require email, don\'t include phone, optionally notes, and company.', 'Optional email, don\'t include phone, and notes.',
  'Require email, don\'t include phone, and optional notes, and company.', 'Require email and phone, not optional notes.',
  'Require email, don\'t include phone, notes are optional.', 'Require email, don\'t include phone, notes not required.',
  'Require email, don\'t include phone or notes.', 'Require email or phone.', 'Require email, don\'t include phone, or notes.',
  'Require email, not phone or notes.', 'Require phone and email, not notes, nor company.', 'Require email, not phone, nor notes, and company.',
  'Require email and not company, phone and notes.', 'Include email, but phone and notes are not required.', 'Include email, phone and notes, not required.',
];
it('cases', () => {
  const out: string[] = [];
  for (const p of prompts) {
    const r = suggestPromptFields(p, F);
    out.push(`${p}\n  title=${JSON.stringify(r.title)}\n  fields=${JSON.stringify(r.fields.map(f => [f.field.name, f.required]))}\n  unmatched=${JSON.stringify(r.unmatched)}`);
  }
  writeFileSync('/workspace/.fm-scratch/r4/out2.txt', out.join('\n'));
});
