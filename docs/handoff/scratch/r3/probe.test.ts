import { describe, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { suggestPromptFields } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/services/fmWebPromptDraft';

const simple = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Company' }];

const show = (prompt: string, fields = simple): string => {
  try {
    const r = suggestPromptFields(prompt, fields as never);
    return JSON.stringify({
      title: r.title ?? null,
      fields: r.fields.map((f) => [f.field.name, f.required ?? null]),
      unmatched: r.unmatched
    });
  } catch (e) { return 'THREW: ' + (e as Error).message; }
};

const PROMPTS = [
  // --- F1: bare "not"
  'Include email but not phone.',
  'Require name and email, but not phone.',
  'Include email, not phone.',
  // --- F2 / R2: coordination + anchor
  "Include email, don't include phone, and notes.",
  "Don't include phone, notes.",
  "Don't include phone, but include email, and notes.",
  'Exclude phone, company, and notes.',
  'Include email, exclude phone, and notes.',
  "Don't include phone, and notes.",
  "Don't include phone, but include email.",
  'Include email, but exclude phone, and notes.',
  'Include email and don\'t include phone.',
  "Don't include phone and notes.",
  'Exclude phone, notes.',
  'Require name, email, and phone. Add optional notes, then session.',
  // --- R1: emphatic inclusion
  'Include not only email but also phone.',
  'Include all the fields, not just email.',
  'Include email, not only phone but also notes.',
  'Include not merely email but phone.',
  'Include not simply email but phone.',
  'Include email but not only phone.',
  // --- R3: qualifier flip
  'Include email. Email is not required.',
  'Include email but not required phone.',
  'Include email and email is not optional.',
  'Include email and not strictly required phone.',
  'Include email but not strictly optional phone.',
  'Do not require "Phone".',
  'Do not require phone.',
  'Do not require phone, but include email.',
  'Include email, not required phone.',
  'Include email, phone is not required.',
  // --- R4: exclusion vocabulary
  'Make a form that excludes phone and includes email.',
  'Create a form that omits phone. Include email.',
  'Draft a registration form leaving out phone, including email.',
  'Include everything except phone and email.',
  'Include email without phone.',
  'Include email without the phone number.',
  'Skip phone and include email.',
  'Never collect phone, include email.',
  'No need for phone, include email.',
  'Form excluding phone.',
  'Form with phone excluded.',
  'Form that leaves out phone.',
  // --- F3: unterminated quote
  'Require "Name and email',
  'Include "Name and email',
  'Include email and "Phone',
  // --- titles
  'Make a form with email and notes.',
  'Create a form with email.',
  'Build a form for registration.',
  'Create a registration form with email.',
  'Make a workshop registration form. Include email.',
  'Draft a form titled "Badge print". Include email.',
  // --- misc / adversarial
  'Include email.',
  'Email.',
  'include email',
  'Include email and email and email.',
  'Include all fields.',
  'Include everything.',
  'Include none.',
  'Exclude everything.',
  'Include email but not phone and not notes.',
  'Do not include email but include phone.',
  'Do not include email, but include phone.',
  'Do not include email or include phone.',
  'Do not include email or phone.',
  'Do not include email, notes.',
  'Not email, not phone.',
  'Email is required. Phone is optional.',
  'Phone is required, email is not required.',
  'Require email and phone, exclude notes.',
  'Include email. Exclude email.',
  'Exclude email. Include email.',
  'Include email and notes and company and phone.',
  'Add email, add phone.',
  'Include email, add phone, and notes.',
  'Include email, add phone, notes.',
  'include email and require phone and include notes',
  'Collect email, including name and company.',
  'Include email and require phone, including notes.',
  'Please include email. Do not include phone.',
  'Include the email field and the phone field.',
  'Email and phone, not notes.',
  'Required: email. Optional: phone.',
  'include email; exclude phone',
  'Include email\nExclude phone',
  'Include email - exclude phone',
  'Include email: exclude phone',
  'Include email (exclude phone)',
  'Do not include phone, but include email, and notes.',
  'Exclude phone, but include email, and notes.',
  'Exclude phone, but include email and notes.',
  'Require email, exclude phone, and notes.',
  'Require email, exclude phone, notes.',
  'Not required phone, include email.',
  'Do not only email but also phone.',
  'Include everything but phone.',
  'Include all but not phone.',
  'Everything except phone.',
  'Include phone, except email.'
];

describe('probe', () => {
  it('dumps results', () => {
    const lines = PROMPTS.map((p) => `${JSON.stringify(p)}\n    ${show(p)}`);
    writeFileSync('/workspace/.fm-scratch/r3/probe-out.txt', lines.join('\n') + '\n');
  });
});
