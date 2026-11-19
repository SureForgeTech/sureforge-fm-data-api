import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { suggestPromptFields as current } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/services/fmWebPromptDraft';
import { suggestPromptFields as previous } from '/workspace/.fm-scratch/r5/fmWebPromptDraft.5762583';

type Field = { name: string; kind?: string; type?: string; required?: boolean; options?: string[] };

const REG: Field[] = [
  { name: 'Name' },
  { name: 'Email' },
  { name: 'Phone' },
  { name: 'Company' },
  { name: 'Notes' },
  { name: 'Session' },
  { name: 'Accessibility_Notes' },
  { name: ' Full Name ' },
  { name: 'EmailAddress' },
  { name: 'WorkshopSession', type: 'text', options: ['Morning', 'Afternoon'] },
  { name: 'Count', kind: 'calculation' },
  { name: 'Total', kind: 'summary' },
  { name: 'Photo', type: 'container' },
  { name: 'GlobalPhone', kind: 'global' },
  { name: ' Registration::Badge, Display ' }
];

const SIMPLE: Field[] = [
  { name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Company' }, { name: 'Session' }
];

const show = (fn: typeof current, prompt: string, fields: Field[]) => {
  try {
    const result = fn(prompt, fields as never);
    return {
      threw: false as const,
      title: result.title ?? null,
      fields: result.fields.map((item) => [item.field.name, item.required ?? null, item.field === fields.find((field) => field.name === item.field.name)] as const),
      names: result.fields.map((item) => item.field.name),
      required: result.fields.map((item) => [item.field.name, item.required ?? null] as const),
      unmatched: result.unmatched,
      sameObjects: result.fields.every((item) => fields.includes(item.field as Field))
    };
  } catch (error) {
    return { threw: true as const, message: (error as Error).message };
  }
};

const line = (prompt: string, fields: Field[] = SIMPLE) => {
  const now = show(current, prompt, fields);
  const old = show(previous, prompt, fields);
  const nowText = now.threw ? 'THREW ' + now.message : JSON.stringify({ title: now.title, fields: now.required, unmatched: now.unmatched });
  const oldText = old.threw ? 'THREW ' + old.message : JSON.stringify({ title: old.title, fields: old.required, unmatched: old.unmatched });
  return { prompt, now, old, nowText, oldText, changed: nowText !== oldText };
};

describe('stated decisions and claimed fixes', () => {
  const fields = SIMPLE;

  it('coordinated items inherit the list anchor, not the previous item', () => {
    expect(current("Don't include phone, notes.", fields).fields).toEqual([]);
    expect(current("Include email, don't include phone, and notes.", fields).fields.map((item) => item.field.name)).toEqual(['Email', 'Notes']);
    expect(current("Don't include phone, but include email, and notes.", fields).fields.map((item) => item.field.name)).toEqual(['Email', 'Notes']);
    expect(current('Include email, don\'t include phone, notes.', fields).fields.map((item) => item.field.name)).toEqual(['Email', 'Notes']);
  });

  it('an exclusion does not end the requirement scope of the list head', () => {
    expect(current('Require email, don\'t include phone, and notes.', fields).fields.map((item) => [item.field.name, item.required]))
      .toEqual([['Email', true], ['Notes', true]]);
    expect(current('Require email, and notes.', fields).fields.map((item) => [item.field.name, item.required]))
      .toEqual([['Email', true], ['Notes', true]]);
  });

  it('not required / not optional are requirements, before or after the field', () => {
    expect(current('Include email but not required phone.', fields).fields.map((item) => [item.field.name, item.required ?? null]))
      .toEqual([['Email', null], ['Phone', false]]);
    expect(current('Include email and not strictly required phone.', fields).fields.map((item) => [item.field.name, item.required ?? null]))
      .toEqual([['Email', null], ['Phone', false]]);
    expect(current('Require email, notes not required.', fields).fields.map((item) => [item.field.name, item.required ?? null]))
      .toEqual([['Email', true], ['Notes', false]]);
    expect(current('Require email, notes optional.', fields).fields.map((item) => [item.field.name, item.required ?? null]))
      .toEqual([['Email', true], ['Notes', false]]);
    expect(current('Include email. Email is not required.', [{ name: 'Email' }]).fields)
      .toEqual([{ field: { name: 'Email' }, required: false }]);
    expect(current('Include email and email is not optional.', [{ name: 'Email' }]).fields)
      .toEqual([{ field: { name: 'Email' }, required: true }]);
  });

  it('keeps fields named in the opening title and does not take the article as the title', () => {
    const named = current('Make a name and email form.', fields);
    expect(named.title).toBe('Name and email');
    expect(named.fields.map((item) => item.field.name)).toEqual(['Name', 'Email']);
    expect(current('Make a form with email.', fields).title).toBeUndefined();
    expect(current('Make a form with email.', fields).fields.map((item) => item.field.name)).toEqual(['Email']);
    expect(current('Make the form.', []).title).toBeUndefined();
    expect(current('Create an A Team form with email.', fields).title).toBe('A Team');
    expect(current('Build a The Gala form with email.', fields).title).toBe('The Gala');
    expect(current('Make a registration form.', []).title).toBe('Registration');
  });

  it('preserves exact metadata, skips read-only, and does not guess', () => {
    const custom = { name: ' Registration::Badge, Display ' };
    const quoted = current('Include " Registration::Badge, Display ".', [custom, { name: 'Count', kind: 'calculation' }]);
    expect(quoted.fields).toEqual([{ field: custom, required: undefined }]);
    expect(quoted.fields[0]?.field).toBe(custom);

    const frozen = Object.freeze({ name: 'Given Name', required: true });
    const given = current('Include first name.', Object.freeze([frozen]));
    expect(given.fields[0]?.field).toBe(frozen);
    expect(frozen.required).toBe(true);

    const ambiguous = current('Require email.', [{ name: 'Email' }, { name: 'email ' }]);
    expect(ambiguous.fields).toEqual([]);
    expect(ambiguous.unmatched).toEqual(['Email']);

    const readonly = current('Require email and phone. Include photo, count, total and global phone.', [
      { name: 'Email' },
      { name: 'Phone', kind: 'global' },
      { name: 'Photo', type: 'container' },
      { name: 'Count', kind: 'calculation' },
      { name: 'Total', kind: 'summary' }
    ]);
    expect(readonly.fields.map((item) => item.field.name)).toEqual(['Email']);
    expect(readonly.unmatched).toEqual(expect.arrayContaining(['Phone']));
    expect(readonly.fields.some((item) => /photo|count|total|global/i.test(item.field.name))).toBe(false);
  });
});

describe('adversarial corpus', () => {
  it('writes current vs 5762583 results', () => {
    const prompts = [
      // claimed fixes
      'Require email, notes not required.',
      "Require email, don't include phone, notes not required.",
      'Require email, notes optional.',
      'Make a name and email form.',
      'Create a name and email form with phone.',
      'Make a form with email.',
      'Create an A Team form with email.',
      'Build a The Gala form with email.',
      'Make an Annual form with email.',
      'Create an email form.',
      // suffix attacks: trailing qualifier on a list
      'Name, email and phone required.',
      'Make name, email and phone required.',
      'Include name, email and phone required.',
      'Add name, email, and phone optional.',
      'Require name, email and phone not required.',
      'name, email and phone not required.',
      'Include email, phone required.',
      'Include email required, phone.',
      'Include name required email.',
      'Collect name required documents and email.',
      'Add session optional breakouts and email.',
      'Include notes required reading and email.',
      'Include email as well as phone.',
      'Include email as required.',
      'Add notes as required.',
      'Include phone as required by the venue.',
      'Include email as needed and phone.',
      // comma splits the negation from the field
      'Require email, notes, not required.',
      'Require email, notes, optional.',
      'Include email, not required.',
      'Include email, is not required.',
      'Require email, phone, not required, and notes.',
      'Notes, not required. Include email.',
      'Require email, notes not required, and phone.',
      // contractions and extra words
      "Require email, phone isn't required.",
      "Require email, notes aren't required.",
      'Include email. Email is not at all required.',
      'Require email, and phone is not at all required.',
      'Include email. Email should not be required.',
      'Require name, email and phone should not be required.',
      'Include email not currently required.',
      'Include phone not at all required.',
      'Include email and not at all required phone.',
      'Include email but not the required phone.',
      'Include notes not the required email.',
      'Do not include the required email.',
      "Include email but not a required phone.",
      'not required phone and email.',
      'notes not strictly required. Require email.',
      'Require email, notes are not required.',
      'Require email, notes is not optional.',
      // title-stay spurious suggestions
      'Make a company picnic registration form. Require name and email.',
      'Create a session feedback form. Require email.',
      'Make a phone support form. Include name and email.',
      'Build an email newsletter form. Include name.',
      'Draft a notes form for volunteers. Include email.',
      'Make a registration form. Include email and phone.',
      'Create an event registration form with name and email.',
      'Make a guest registration form with name, email, organization, and optional notes.',
      'Build a workshop registration form. Require attendee name and email, let attendees choose a session, and add an optional accessibility notes field.',
      'Make email a required form field.',
      'Make name required on the form.',
      'Create phone and email form fields.',
      'Make a required name and email form.',
      'Make an optional notes form.',
      // syntax words as field names
      'Make a registration form. Include email.',
      'Create a registration form. Include email.',
      'Draft a registration form. Include email.',
      'Build a registration form. Include email.',
      'Make a form with email.',
      // anchor / polarity stress
      "Don't include phone, but include email, and notes.",
      "Don't include phone, but include email, notes.",
      "Don't include phone but include email, and notes.",
      "Include email, don't include phone, and notes.",
      "Include email, don't include phone, notes.",
      "Don't include phone, notes.",
      "Don't include phone, include email, notes.",
      "Don't include phone, but include email, don't include notes, company.",
      'Exclude phone, company, and notes.',
      'Include email but not phone.',
      'Include not only email but also phone.',
      'Include all the fields, not just email.',
      'Include everything except phone and email.',
      'Include everything but phone.',
      'Make a form that excludes phone and includes email.',
      'Create a form that omits phone. Include email.',
      'Draft a registration form leaving out phone, including email.',
      'Do not require phone.',
      'Require phone. Do not require phone.',
      'Include phone except.',
      'Add name, email, phone not.',
      'Include phone not included.',
      // optional list scope
      'Add optional name, email, and phone.',
      'Include optional notes and email.',
      'Require optional notes and email.',
      'Add optional notes, comments, and email.',
      // exact / ambiguous / readonly on the rich layout
      'Include " Registration::Badge, Display " and email.',
      'Require "Name and email',
      'Include email and EmailAddress.',
      'Include photo and count and phone.',
      'Include a company name.',
      'Include first name and given name.',
      'Include accessibility notes and notes.',
      // title called/titled stripping
      'Include the field called "Email".',
      'Require the field called "Phone".',
      'Draft a form titled "Badge print". Include " Registration::Badge, Display ".',
      'Make a registration form. Include a field called "Email".',
      // emphatic / reversal
      'Include email, not only phone but also notes.',
      "Never collect phone, include email.",
      'Skip the phone field and include email.',
      'No need for phone, include email.',
      // length and empty
      '',
      'x'.repeat(2000),
      'x'.repeat(2001)
    ];

    const syntaxLayout: Field[] = [
      ...SIMPLE,
      { name: 'Form' },
      { name: 'Make' },
      { name: 'Create' },
      { name: 'Draft' },
      { name: 'Build' },
      { name: 'A' },
      { name: 'The' },
      { name: 'Registration' }
    ];

    const lines: string[] = [];
    const diffs: string[] = [];
    for (const prompt of prompts) {
      const row = line(prompt, SIMPLE);
      lines.push((row.changed ? 'DIFF' : 'SAME') + ' ' + JSON.stringify(prompt));
      lines.push('  now: ' + row.nowText);
      lines.push('  old: ' + row.oldText);
      if (row.changed) diffs.push(JSON.stringify(prompt) + '\n  now: ' + row.nowText + '\n  old: ' + row.oldText);
    }
    lines.push('\n## syntax-word field names');
    for (const prompt of [
      'Make a registration form. Include email.',
      'Create a registration form. Include email.',
      'Draft a registration form. Include email.',
      'Build a registration form. Include email.',
      'Make a form with email.',
      'Create an A Team form with email.',
      'Make a name and email form.',
      'Make a company picnic registration form. Require name and email.'
    ]) {
      const row = line(prompt, syntaxLayout);
      lines.push((row.changed ? 'DIFF' : 'SAME') + ' ' + JSON.stringify(prompt));
      lines.push('  now: ' + row.nowText);
      lines.push('  old: ' + row.oldText);
    }

    lines.push('\n## rich layout');
    for (const prompt of [
      'Include " Registration::Badge, Display ". Require email. Include photo, count, total, and global phone.',
      'Build a workshop registration form. Require attendee name and email, let attendees choose a session, and add an optional accessibility notes field.',
      'Include first name.',
      'Require email and phone. Include notes.'
    ]) {
      const row = line(prompt, REG);
      lines.push((row.changed ? 'DIFF' : 'SAME') + ' ' + JSON.stringify(prompt));
      lines.push('  now: ' + row.nowText);
      lines.push('  old: ' + row.oldText);
      if (!row.now.threw) {
        lines.push('  sameObjects=' + row.now.sameObjects + ' names=' + JSON.stringify(row.now.names));
      }
    }

    lines.push('\nDIFF COUNT ' + diffs.length);
    writeFileSync('/workspace/.fm-scratch/r5/results.txt', lines.join('\n') + '\n');
    expect(lines.length).toBeGreaterThan(10);
  });
});
