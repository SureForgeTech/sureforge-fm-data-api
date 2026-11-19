import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { suggestPromptFields as before } from '/workspace/.fm-scratch/mine/fmWebPromptDraft.original';
import { suggestPromptFields as after } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/services/fmWebPromptDraft';

type Field = { name: string; kind?: string; required?: boolean };
const LAYOUTS: Record<string, Field[]> = {
  common: [
    { name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Company' }, { name: 'Notes' },
    { name: 'Session' }, { name: 'Accessibility_Notes' }, { name: 'AttendeeName' }, { name: 'EmailAddress' },
    { name: 'Count', kind: 'calculation' }, { name: 'Global', kind: 'global' }
  ],
  custom: [{ name: ' Registration::Badge, Display ' }, { name: 'Count', kind: 'calculation' }],
  quoted: [{ name: ' Email ' }, { name: 'EmailAddress' }, { name: 'Microphone' }, { name: 'Notebook' }],
  simple: [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Company' }]
};

const PROMPTS = [
  'Build a workshop registration form. Require attendee name and email, let attendees choose a session, and add an optional accessibility notes field.',
  'Require email and phone. Include notes.',
  'Draft a form titled "Badge print". Include " Registration::Badge, Display ", "Count", and "Missing".',
  'Include accessibility notes. Do not include email. Require phone.',
  'Include first name and given name.',
  'Include a company name.',
  'Include email. Email is required. Include email.',
  "Include email but exclude phone and company, and add notes. Don't require session.",
  'Require name, email, and phone. Add optional notes, then session.',
  'Include zzfmquote1zz but exclude "Phone".',
  'Do not include "Email" or collect "Phone".',
  'Do not include "Email", but collect "Phone".',
  'Include "Email" and "Phone". Exclude "Phone".',
  'Require "Phone". Do not require "Phone".',
  'Do not require "Phone".',
  'Include "Email". Do not collect "Phone" or require "Email".',
  'Exclude phone, company, and notes.',
  "Don't include phone, notes.",
  "Include email, don't include phone, and notes.",
  'Include email but not phone.',
  'Require name and email, but not phone.',
  'Include email, not phone.',
  'Include email. Email is not required.',
  'Include email but not required phone.',
  'Include email and email is not optional.',
  'Never collect phone, include email.',
  'Skip the phone field and include email.',
  'No need for phone, include email.',
  'Include not only email but also phone.',
  'Include all the fields, not just email.',
  'Include email, not only phone but also notes.',
  "Don't include phone, but include email, and notes.",
  "Don't include phone but include email and notes.",
  'Include email and not strictly required phone.',
  'Include email and email is not optional.',
  'Make a form that excludes phone and includes email.',
  'Create a form that omits phone. Include email.',
  'Draft a registration form leaving out phone, including email.',
  'Include everything except phone and email.',
  'Include email and require phone, including notes.',
  'Collect email, including name and company.',
  'Include name, email, and phone',
  'include email',
  'Email.',
  'Require "Name and email',
  'Include "Name and email',
  'Include Email Address and Phone Number.',
  'Require attendee name, email and optional session, exclude company.',
  'Please include email. Do not include phone.',
  'Collect email, name and company.',
  'Add a company field and a notes field.',
  'x'.repeat(2001),
  ''
];

const show = (r: { fields: Array<{ field: { name: string }; required?: boolean }>; unmatched: string[]; title?: string }) =>
  JSON.stringify({
    title: r.title,
    fields: r.fields.map((f) => [f.field.name, f.required ?? null]),
    unmatched: r.unmatched
  });

const run = (fn: typeof before, prompt: string, layout: Field[]) => {
  try { return show(fn(prompt, layout as never)); }
  catch (error) { return 'THREW:' + (error as Error).message; }
};

describe('differential: original vs fixed suggestPromptFields', () => {
  it('reports every difference across the corpus', () => {
    const diffs: string[] = [];
    for (const [layoutName, layout] of Object.entries(LAYOUTS)) {
      for (const prompt of PROMPTS) {
        const b = run(before, prompt, layout);
        const a = run(after, prompt, layout);
        if (a !== b) diffs.push(`[${layoutName}] ${JSON.stringify(prompt)}\n  before: ${b}\n  after:  ${a}`);
      }
    }
    console.log('DIFFERENCES (' + diffs.length + '):\n' + diffs.join('\n'));
    writeFileSync('/workspace/.fm-artifacts/differential.txt',
      'DIFFERENCES (' + diffs.length + '):\n' + diffs.join('\n') + '\n');
    expect(diffs.length).toBeGreaterThan(-1);
  });
});
