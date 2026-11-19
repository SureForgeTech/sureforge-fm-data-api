import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { suggestPromptFields } from '/workspace/.fm-scratch/r4/prev';

const F = [
  { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Name' }, { name: 'Company' },
  { name: 'First Name' }, { name: 'Last Name' }, { name: 'Session' }, { name: 'Accessibility Notes' },
  { name: 'Dietary Requirements' }, { name: 'Count', kind: 'calculation' }, { name: 'Badge', kind: 'global' }
];
const prompts: string[] = [
  'Make a name and email form.', 'Create a name and email form with phone.', 'Build the Notes and Email form.',
  'Create an A-Team form with email.', 'Create an A Team form with email.', 'Create the A Team form for email.',
  'Build a form called "A Team" with email.', 'Create a registration form titled "" with email.', 'Create a form. A form with email.',
  'Build a The Gala form with email.', 'Make a form for the Event with email and phone.', 'Create a form with a name field and email form.',
  'Make a. Form with email.', 'Make the form with email.', 'Create A form with email.', 'Create an  form with email.',
  'make a form', 'create the a form with email.', 'Create a an event form with email.',
];
it('cases', () => {
  const out: string[] = [];
  for (const p of prompts) {
    const r = suggestPromptFields(p, F);
    out.push(`${p}\n  title=${JSON.stringify(r.title)}\n  fields=${JSON.stringify(r.fields.map(f => [f.field.name, f.required]))}\n  unmatched=${JSON.stringify(r.unmatched)}`);
  }
  writeFileSync('/workspace/.fm-scratch/r4/prev4.txt', out.join('\n'));
});
