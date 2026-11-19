import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { suggestPromptFields as before } from '/workspace/.fm-scratch/mine/fmWebPromptDraft.original';
import { suggestPromptFields as after } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/services/fmWebPromptDraft';

type Field = { name: string; kind?: string; required?: boolean };
const LAYOUT: Field[] = [{ name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Name' }, { name: 'Company' }];

const CASES: string[] = [
  // P1-1: an unqualified requirement negation after the field.
  "Require email, don't include phone, notes not required.",
  'Require email, notes not required.',
  'Require email, notes optional.',
  'Require email, and notes.',
  'Require email, don\'t include phone, and notes.',
  // P1-2: field names inside the opening title.
  'Make a name and email form.',
  'Create a name and email form with phone.',
  'Make a form with email.',
  'Create an A Team form with email.',
  'Build a The Gala form with email.',
  'Make a registration form.',
  'Build a workshop registration form. Require attendee name and email, let attendees choose a session, and add an optional accessibility notes field.',
  'Draft a form titled "Badge print". Include " Registration::Badge, Display ", "Count", and "Missing".',
  'Include email. Email is required. Include email.',
  'Include email but not phone.',
  "Include email, don't include phone, and notes.",
  "Don't include phone, but include email, and notes.",
  "Don't include phone, notes.",
  'Exclude phone, company, and notes.',
  'Require name, email, and phone.',
  'Add optional notes, then session.',
];

const show = (r: { title?: string; fields: Array<{ field: { name: string }; required?: boolean }>; unmatched: string[] }) =>
  JSON.stringify({
    title: r.title ?? null,
    fields: r.fields.map((f) => [f.field.name, f.required ?? null]),
    unmatched: r.unmatched
  });

describe('round 4 fixes', () => {
  it('records old vs new for the P1-1 and P1-2 cases', () => {
    const out: string[] = [];
    for (const prompt of CASES) {
      out.push(`${JSON.stringify(prompt)}\n  old: ${show(before(prompt, LAYOUT as never))}\n  new: ${show(after(prompt, LAYOUT as never))}`);
    }
    writeFileSync('/workspace/.fm-artifacts/round4-cases.txt', out.join('\n') + '\n');
    expect(out.length).toBe(CASES.length);
  });
});
