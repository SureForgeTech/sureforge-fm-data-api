import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { suggestPromptFields } from '/workspace/.fm-scratch/r4/prev';

const F = [
  { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Name' }, { name: 'Company' },
  { name: 'First Name' }, { name: 'Last Name' }, { name: 'Session' }, { name: 'Accessibility Notes' },
  { name: 'Dietary Requirements' }, { name: 'Count', kind: 'calculation' }, { name: 'Badge', kind: 'global' }
];
const prompts: string[] = [
  'Make a form with email.', 'Create a form', 'Make an email form', 'Create a form for a conference',
  'Build the A Team form with email', 'Create a registration form with email', 'Build the event signup form with email',
  'Create a form for emails', 'Create a form that collects a name', 'Make a form for a registration form',
  'Build a workshop registration form. Require email.', 'Create an event form titled "Gala" with email',
  'Create The Summit form with email', 'Build an attendee form with name',
  "Don't include phone, notes.", "Include email, don't include phone, and notes.", "Don't include phone, but include email, and notes.",
  "Require email, don't include phone, and notes.", 'Require email, and notes.', 'Include email, notes, and not phone.',
  'Not required phone.', 'Phone not required.', 'Name is not required, email is required.', 'Require email. Phone not required and notes.',
  'Require email and phone, not notes.', 'Require email and phone not notes.', 'Require email, but not phone.',
  'Require email, but not phone, and notes.', 'Include email, but not phone, and notes.',
  'Require email and not phone and notes.', 'Include email and phone except notes.', 'Include email, phone except notes.',
  'Include notes, email, phone. Do not require notes.', 'Include email. Require phone, not email.',
  'Require email, phone and notes. Make phone optional, and notes.', 'Require email. Optional phone, and notes.',
  'Require email, not optional phone, and notes.', 'Include email and phone, but do not require phone, and notes.',
  "Require email, don't include phone, and notes, and company.", "Require email, don't include phone, name and notes.",
  "Require email, don't include phone. Name and notes.", "Require email. Don't include phone, notes.",
  'Require email, phone, excluding notes, and company.', 'Require email, omit phone, and company.',
  'Require email and company, but leave out phone and notes.', 'Include email and notes, skip phone.',
  'Require the email, but not the phone, and notes.', 'Require first name, last name and email, except phone.',
  'Include email, not only phone but also notes.', 'Include email, not just phone, and notes.',
  'Include Phone. Require Notes, not Email.', 'Require email, then not phone and notes.',
  'Require email but not notes, and phone.', 'Require email, but not notes. Phone too.',
  'Include the session, dietary requirements, and accessibility notes.', 'Require notes, but not required email, and phone.',
  'Include email. Not email. Phone.', 'Include email. Do not include email, and notes.',
  'Include everything but phone.', 'Count and badge should be excluded. Require email.',
  'Include Count and Badge and email.', 'Require email, phone, and "Odd Name", not notes.',
  'Include email, and "Notes", not phone.', 'Include name, "Company" and email, but not "Phone.',
  'Require name and email, and not optional phone.',
];
it('cases', () => {
  const out: string[] = [];
  for (const p of prompts) {
    const r = suggestPromptFields(p, F);
    out.push(`${p}\n  title=${JSON.stringify(r.title)}\n  fields=${JSON.stringify(r.fields.map(f => [f.field.name, f.required]))}\n  unmatched=${JSON.stringify(r.unmatched)}`);
  }
  writeFileSync('/workspace/.fm-scratch/r4/prev1.txt', out.join('\n'));
});
