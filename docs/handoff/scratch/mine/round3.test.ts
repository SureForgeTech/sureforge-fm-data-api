import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { suggestPromptFields as before } from '/workspace/.fm-scratch/mine/fmWebPromptDraft.original';
import { suggestPromptFields as after } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/services/fmWebPromptDraft';

type Field = { name: string; kind?: string; required?: boolean };
const LAYOUT: Field[] = [{ name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Name' }];

const CASES: string[] = [
  'Make a form with email.',
  'Create a form with email.',
  'Build a form for the workshop.',
  'Make a registration form.',
  'Create an event registration form with email.',
  'Make a name form with email.',
  'Make the form.',
  'Require email, don\'t include phone, and notes.',
  'Require email, and notes.',
  'Require name and email but exclude phone, and notes.',
  'Require name, email, and phone.',
  'Add optional notes, then session.',
  'Include email but not phone.',
  "Include email, don't include phone, and notes.",
  "Don't include phone, but include email, and notes.",
  "Don't include phone, notes.",
  'Exclude phone, company, and notes.',
  'Build a workshop registration form. Require attendee name and email, let attendees choose a session, and add an optional accessibility notes field.',
];

const show = (r: { title?: string; fields: Array<{ field: { name: string }; required?: boolean }>; unmatched: string[] }) =>
  JSON.stringify({
    title: r.title ?? null,
    fields: r.fields.map((f) => [f.field.name, f.required ?? null]),
    unmatched: r.unmatched
  });

describe('round 3 fixes', () => {
  it('records old vs new for the F-A and F-E cases', () => {
    const out: string[] = [];
    for (const prompt of CASES) {
      out.push(`${JSON.stringify(prompt)}\n  old: ${show(before(prompt, LAYOUT as never))}\n  new: ${show(after(prompt, LAYOUT as never))}`);
    }
    writeFileSync('/workspace/.fm-artifacts/round3-cases.txt', out.join('\n') + '\n');
    expect(out.length).toBe(CASES.length);
  });
});
