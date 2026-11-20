import { describe, expect, it } from 'vitest';
import { MAX_FORM_PROMPT_LENGTH, suggestPromptFields } from '../../src/services/fmWebPromptDraft';

describe('prompt form suggestions', () => {
  it('recognizes registration concepts and preserves FileMaker spelling and value lists', () => {
    const session = { name: 'WorkshopSession', type: 'text', options: ['Morning', 'Afternoon'] };
    const result = suggestPromptFields(
      'Build a workshop registration form. Require attendee name and email, let attendees choose a session, and add an optional accessibility notes field.',
      [{ name: 'Accessibility_Notes' }, { name: 'AttendeeName' }, { name: ' Email Address ' }, session, { name: 'Notes' }]
    );
    expect(result.title).toBe('Workshop registration');
    expect(result.fields.map(({ field, required }) => [field.name, required])).toEqual([
      ['AttendeeName', true],
      [' Email Address ', true],
      ['WorkshopSession', undefined],
      ['Accessibility_Notes', false]
    ]);
    expect(result.fields[2]?.field).toEqual(session);
    expect(result.unmatched).toEqual([]);
  });

  it('does not guess between similar fields or match unrelated fields on substrings', () => {
    const result = suggestPromptFields('Require email and phone. Include notes.', [
      { name: ' Email ' }, { name: 'EmailAddress' }, { name: 'Microphone' }, { name: 'Notebook' }
    ]);
    expect(result.fields).toEqual([]);
    expect(result.unmatched).toEqual(['Email', 'Phone', 'Notes']);
  });

  it('accepts exact quoted custom names and reports read-only or unknown requests', () => {
    const custom = { name: ' Registration::Badge, Display ' };
    const result = suggestPromptFields(
      'Draft a form titled "Badge print". Include " Registration::Badge, Display ", "Count", and "Missing".',
      [custom, { name: 'Count', kind: 'calculation' }]
    );
    expect(result.title).toBe('Badge print');
    expect(result.fields).toEqual([{ field: custom, required: undefined }]);
    expect(result.unmatched).toEqual(['Count', 'Missing']);
  });

  it('does not broaden accessibility into generic notes or pick excluded and global fields', () => {
    const result = suggestPromptFields('Include accessibility notes. Do not include email. Require phone.', [
      { name: 'Notes' }, { name: 'Email' }, { name: 'Phone', kind: 'global' }
    ]);
    expect(result.fields).toEqual([]);
    expect(result.unmatched).toEqual(['Accessibility notes', 'Phone']);
  });

  it('leaves metadata and exact field names unchanged and does not suggest a column twice', () => {
    const metadata = { name: 'Given Name', required: true };
    const result = suggestPromptFields('Include first name and given name.', Object.freeze([Object.freeze(metadata)]));
    expect(result.fields).toEqual([{ field: metadata, required: undefined }]);
    expect(metadata.required).toBe(true);
  });

  it('does not suggest attendee name when the prompt asks only for company name', () => {
    const result = suggestPromptFields('Include a company name.', [{ name: 'Name' }, { name: 'Company' }]);
    expect(result.fields.map(({ field }) => field.name)).toEqual(['Company']);
  });

  it('updates an earlier suggestion with a later explicit requirement', () => {
    const result = suggestPromptFields('Include email. Email is required. Include email.', [{ name: 'Email' }]);
    expect(result.fields).toEqual([{ field: { name: 'Email' }, required: true }]);
  });

  it('scopes exclusions to their own fields and respects a later positive instruction', () => {
    const result = suggestPromptFields(
      "Include email but exclude phone and company, and add notes. Don't require session.",
      [{ name: 'Email' }, { name: 'Phone' }, { name: 'Company' }, { name: 'Notes' }, { name: 'Session' }]
    );
    // "Don't require session" states that session is not required, so it belongs to the form as
    // an optional field rather than being left out.
    expect(result.fields.map(({ field, required }) => [field.name, required])).toEqual([
      ['Email', undefined], ['Notes', undefined], ['Session', false]
    ]);
    expect(result.unmatched).toEqual([]);
  });

  it('carries requirements across a list and resets them for later instructions', () => {
    const result = suggestPromptFields('Require name, email, and phone. Add optional notes, then session.', [
      { name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Session' }
    ]);
    expect(result.fields.map(({ field, required }) => [field.name, required])).toEqual([
      ['Name', true], ['Email', true], ['Phone', true], ['Notes', false], ['Session', undefined]
    ]);
  });

  it('does not confuse literal marker text with an exact quoted field', () => {
    const result = suggestPromptFields('Include zzfmquote1zz but exclude "Phone".', [
      { name: 'zzfmquote1zz' }, { name: 'Phone' }
    ]);
    expect(result.fields.map(({ field }) => field.name)).toEqual(['zzfmquote1zz']);
  });

  it('continues a negated directive across or but allows a positive instruction after but', () => {
    const fields = [{ name: 'Email' }, { name: 'Phone' }];
    expect(suggestPromptFields('Do not include "Email" or collect "Phone".', fields).fields).toEqual([]);
    expect(suggestPromptFields('Do not include "Email", but collect "Phone".', fields).fields)
      .toEqual([{ field: fields[1], required: undefined }]);
  });

  it('removes a previously suggested field and permits an explicit reinclude', () => {
    const fields = [{ name: 'Email' }, { name: 'Phone' }];
    const excludePhone = 'Include "Email" and "Phone". Exclude "Phone".';
    expect(suggestPromptFields(excludePhone, fields).fields.map(({ field }) => field.name)).toEqual(['Email']);
    expect(suggestPromptFields(excludePhone + ' Include optional "Phone".', fields).fields)
      .toEqual([{ field: fields[0], required: undefined }, { field: fields[1], required: false }]);
  });

  it('keeps a field that should not be required, whether it was included before or named by the requirement alone', () => {
    const fields = [{ name: 'Phone' }];
    expect(suggestPromptFields('Require "Phone". Do not require "Phone".', fields).fields)
      .toEqual([{ field: fields[0], required: false }]);
    // "Do not require X" states that X is not required: the field belongs to the form as an
    // optional one, the same as the adjective form reads it.
    expect(suggestPromptFields('Do not require "Phone".', fields).fields)
      .toEqual([{ field: fields[0], required: false }]);
  });

  it('reads "do not require X" as an optional field, the same as the adjective form', () => {
    const fields = [{ name: 'Email' }, { name: 'Phone' }];
    // The two phrasings of the same intent now agree, and the field is no longer dropped.
    expect(suggestPromptFields('Do not require phone.', fields).fields)
      .toEqual([{ field: fields[1], required: false }]);
    expect(suggestPromptFields('Do not require phone.', fields).unmatched).toEqual([]);
    expect(suggestPromptFields('Include email but not required phone.', fields).fields)
      .toEqual([{ field: fields[0], required: undefined }, { field: fields[1], required: false }]);
    // A field the prompt names only by the negation still reaches the form.
    expect(suggestPromptFields('Do not require phone. Include notes.', [
      { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }
    ]).fields.map(({ field, required }) => [field.name, required])).toEqual([
      ['Phone', false], ['Notes', undefined]
    ]);
    // A field the prompt cannot name exactly is left for manual mapping, as in any other
    // instruction, rather than dropped.
    const ambiguous = suggestPromptFields('Do not require phone.', [{ name: 'Phone' }, { name: 'Mobile number' }]);
    expect(ambiguous.fields).toEqual([]);
    expect(ambiguous.unmatched).toEqual(['Phone']);
  });

  it('distinguishes collecting a field from requiring it in a coordinated exclusion', () => {
    const fields = [{ name: 'Email' }, { name: 'Phone' }];
    const result = suggestPromptFields('Include "Email". Do not collect "Phone" or require "Email".', fields);
    expect(result.fields).toEqual([{ field: fields[0], required: false }]);
  });

  it('limits prompt size before attempting any match', () => {
    expect(() => suggestPromptFields('x'.repeat(MAX_FORM_PROMPT_LENGTH + 1), [])).toThrow('2,000 characters');
  });

  it('treats a bare "not" as an exclusion', () => {
    expect(suggestPromptFields('Include email but not phone.', [{ name: 'Email' }, { name: 'Phone' }]).fields)
      .toEqual([{ field: { name: 'Email' }, required: undefined }]);
    expect(suggestPromptFields('Require name and email, but not phone.', [
      { name: 'Name' }, { name: 'Email' }, { name: 'Phone' }
    ]).fields).toEqual([
      { field: { name: 'Name' }, required: true },
      { field: { name: 'Email' }, required: true }
    ]);
    expect(suggestPromptFields('Include email, not phone.', [{ name: 'Email' }, { name: 'Phone' }]).fields)
      .toEqual([{ field: { name: 'Email' }, required: undefined }]);
  });

  it('reads "not required" as optional and "not optional" as required', () => {
    expect(suggestPromptFields('Include email. Email is not required.', [{ name: 'Email' }]).fields)
      .toEqual([{ field: { name: 'Email' }, required: false }]);
    expect(suggestPromptFields('Include email but not required phone.', [{ name: 'Email' }, { name: 'Phone' }]).fields)
      .toEqual([{ field: { name: 'Email' }, required: undefined }, { field: { name: 'Phone' }, required: false }]);
    expect(suggestPromptFields('Include email and email is not optional.', [{ name: 'Email' }]).fields)
      .toEqual([{ field: { name: 'Email' }, required: true }]);
    expect(suggestPromptFields('Include email and not strictly required phone.', [{ name: 'Email' }, { name: 'Phone' }]).fields)
      .toEqual([{ field: { name: 'Email' }, required: undefined }, { field: { name: 'Phone' }, required: false }]);
  });

  it('keeps a coordinated item with the list head rather than with the item before it', () => {
    // "notes" coordinates with the head "Include email", so the exclusion of phone does not swallow it.
    expect(suggestPromptFields("Include email, don't include phone, and notes.", [
      { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }
    ]).fields.map(({ field }) => field.name)).toEqual(['Email', 'Notes']);
    // The head is negated here, so the coordinated item stays excluded with it.
    expect(suggestPromptFields("Don't include phone, notes.", [{ name: 'Phone' }, { name: 'Notes' }]).fields)
      .toEqual([]);
    // An exclusion still covers the whole list it names.
    expect(suggestPromptFields('Exclude phone, company, and notes.', [
      { name: 'Phone' }, { name: 'Company' }, { name: 'Notes' }
    ]).fields).toEqual([]);
  });

  it('keeps a coordinated item with an explicit reversal of the list', () => {
    const fields = [{ name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }];
    expect(suggestPromptFields("Don't include phone, but include email, and notes.", fields).fields
      .map(({ field }) => field.name)).toEqual(['Email', 'Notes']);
  });

  it('keeps a requirement at the end of the list off the items it does not cover', () => {
    const fields = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }];
    // A bare "not required" overrides only the item it follows.
    expect(suggestPromptFields('Require email, notes not required.', fields).fields)
      .toEqual([{ field: { name: 'Email' }, required: true }, { field: { name: 'Notes' }, required: false }]);
    // A stated requirement settles its list, so the next list is read on its own.
    expect(suggestPromptFields('Name and email are optional, notes and phone are required.', fields).fields)
      .toEqual([{ field: { name: 'Name' }, required: false }, { field: { name: 'Email' }, required: false },
        { field: { name: 'Notes' }, required: true }, { field: { name: 'Phone' }, required: true }]);
    // A requirement for one item leaves the others of its list alone.
    expect(suggestPromptFields('Include email and phone, only email required.', fields).fields)
      .toEqual([{ field: { name: 'Email' }, required: true }, { field: { name: 'Phone' }, required: undefined }]);
    // A requirement in another sentence does not reach back into the first one.
    expect(suggestPromptFields('Include email and phone. Phone required.', fields).fields)
      .toEqual([{ field: { name: 'Email' }, required: undefined }, { field: { name: 'Phone' }, required: true }]);
    // A later requirement does not reach into an earlier list that already stated its own.
    expect(suggestPromptFields('Optional name and email, phone required.', fields).fields)
      .toEqual([{ field: { name: 'Name' }, required: false }, { field: { name: 'Email' }, required: undefined },
        { field: { name: 'Phone' }, required: true }]);
    expect(suggestPromptFields('Optional name and email, phone are required.', fields).fields)
      .toEqual([{ field: { name: 'Name' }, required: false }, { field: { name: 'Email' }, required: undefined },
        { field: { name: 'Phone' }, required: true }]);
    expect(suggestPromptFields('Make email, phone and notes required.', fields).fields)
      .toEqual([{ field: { name: 'Email' }, required: true }, { field: { name: 'Phone' }, required: true },
        { field: { name: 'Notes' }, required: true }]);
  });

  it('keeps a requirement that names one field off the rest of the list', () => {
    const fields = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }];
    // A singular copula names the field it follows, even inside a coordinated list.
    expect(suggestPromptFields('Include email and phone, email is required.', fields).fields)
      .toEqual([{ field: { name: 'Email' }, required: true }, { field: { name: 'Phone' }, required: undefined }]);
    expect(suggestPromptFields('Include name and email, phone is required.', fields).fields)
      .toEqual([{ field: { name: 'Name' }, required: undefined }, { field: { name: 'Email' }, required: undefined },
        { field: { name: 'Phone' }, required: true }]);
    expect(suggestPromptFields('Collect name, email, phone is required.', fields).fields)
      .toEqual([{ field: { name: 'Name' }, required: undefined }, { field: { name: 'Email' }, required: undefined },
        { field: { name: 'Phone' }, required: true }]);
    expect(suggestPromptFields('Include email and phone, email is optional.', fields).fields)
      .toEqual([{ field: { name: 'Email' }, required: false }, { field: { name: 'Phone' }, required: undefined }]);
  });

  it('marks every field of a list when the requirement is stated at the end of the list', () => {
    const fields = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }];
    expect(suggestPromptFields('Name and email are required.', fields).fields)
      .toEqual([{ field: { name: 'Name' }, required: true }, { field: { name: 'Email' }, required: true }]);
    expect(suggestPromptFields('Name, email, and phone are required.', fields).fields)
      .toEqual([{ field: { name: 'Name' }, required: true }, { field: { name: 'Email' }, required: true },
        { field: { name: 'Phone' }, required: true }]);
    expect(suggestPromptFields('Make email and phone required.', fields).fields)
      .toEqual([{ field: { name: 'Email' }, required: true }, { field: { name: 'Phone' }, required: true }]);
    expect(suggestPromptFields('Make email and phone optional.', fields).fields)
      .toEqual([{ field: { name: 'Email' }, required: false }, { field: { name: 'Phone' }, required: false }]);
    expect(suggestPromptFields('Name and email are optional.', fields).fields)
      .toEqual([{ field: { name: 'Name' }, required: false }, { field: { name: 'Email' }, required: false }]);
    expect(suggestPromptFields('Make email, phone and notes required.', fields).fields)
      .toEqual([{ field: { name: 'Email' }, required: true }, { field: { name: 'Phone' }, required: true },
        { field: { name: 'Notes' }, required: true }]);
  });

  it('still reaches every item of a chain after an excluded item was removed from the draft', () => {
    const fields = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }];
    // The exclusion ends the chain it belonged to, so the requirement reaches the fields after it.
    expect(suggestPromptFields('Include name. Add email and phone, exclude name, and notes are required.', fields).fields)
      .toEqual([{ field: { name: 'Email' }, required: undefined }, { field: { name: 'Phone' }, required: undefined },
        { field: { name: 'Notes' }, required: true }]);
  });

  it('does not reach into the fields a directive named', () => {
    const fields = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }];
    expect(suggestPromptFields('Include email and phone, notes are required.', fields).fields)
      .toEqual([{ field: { name: 'Email' }, required: undefined }, { field: { name: 'Phone' }, required: undefined },
        { field: { name: 'Notes' }, required: true }]);
    expect(suggestPromptFields('Include email and phone, notes are optional.', fields).fields)
      .toEqual([{ field: { name: 'Email' }, required: undefined }, { field: { name: 'Phone' }, required: undefined },
        { field: { name: 'Notes' }, required: false }]);
    expect(suggestPromptFields('Include name and email, phone are required.', fields).fields)
      .toEqual([{ field: { name: 'Name' }, required: undefined }, { field: { name: 'Email' }, required: undefined },
        { field: { name: 'Phone' }, required: true }]);
    expect(suggestPromptFields('Include email, exclude phone, and notes are required.', fields).fields)
      .toEqual([{ field: { name: 'Email' }, required: undefined }, { field: { name: 'Notes' }, required: true }]);
    expect(suggestPromptFields('Include email and phone, email and notes are required.', fields).fields)
      .toEqual([{ field: { name: 'Email' }, required: true }, { field: { name: 'Phone' }, required: undefined },
        { field: { name: 'Notes' }, required: true }]);
  });

  it('reads a plain comma-separated list as one phrase, even under a directive', () => {
    const fields = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }];
    expect(suggestPromptFields('Include email, phone are required.', fields).fields)
      .toEqual([{ field: { name: 'Email' }, required: true }, { field: { name: 'Phone' }, required: true }]);
    expect(suggestPromptFields('Include name, email, and phone are required.', fields).fields)
      .toEqual([{ field: { name: 'Name' }, required: true }, { field: { name: 'Email' }, required: true },
        { field: { name: 'Phone' }, required: true }]);
    expect(suggestPromptFields('Include email, phone, and notes are required.', fields).fields)
      .toEqual([{ field: { name: 'Email' }, required: true }, { field: { name: 'Phone' }, required: true },
        { field: { name: 'Notes' }, required: true }]);
    // An explicit coordinator completes the phrase before it, so the list after it is a new one.
    expect(suggestPromptFields('Include email and phone, notes are required.', fields).fields)
      .toEqual([{ field: { name: 'Email' }, required: undefined }, { field: { name: 'Phone' }, required: undefined },
        { field: { name: 'Notes' }, required: true }]);
  });

  it('reads a coordinated phrase joined by "as well as" as one chain', () => {
    const fields = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }];
    expect(suggestPromptFields('Email as well as phone are required.', fields).fields)
      .toEqual([{ field: { name: 'Email' }, required: true }, { field: { name: 'Phone' }, required: true }]);
  });

  it('reads an emphatic inclusion as an inclusion', () => {
    const fields = [{ name: 'Email' }, { name: 'Phone' }];
    expect(suggestPromptFields('Include not only email but also phone.', fields).fields
      .map(({ field }) => field.name)).toEqual(['Email', 'Phone']);
    expect(suggestPromptFields('Include all the fields, not just email.', fields).fields
      .map(({ field }) => field.name)).toEqual(['Email']);
  });

  it('reads the usual ways of excluding a field', () => {
    const fields = [{ name: 'Email' }, { name: 'Phone' }];
    expect(suggestPromptFields('Make a form that excludes phone and includes email.', fields).fields
      .map(({ field }) => field.name)).toEqual(['Email']);
    expect(suggestPromptFields('Create a form that omits phone. Include email.', fields).fields
      .map(({ field }) => field.name)).toEqual(['Email']);
    expect(suggestPromptFields('Draft a registration form leaving out phone, including email.', fields).fields
      .map(({ field }) => field.name)).toEqual(['Email']);
    expect(suggestPromptFields('Include everything except phone and email.', fields).fields).toEqual([]);
  });

  it('reads an exclusion that follows the field it is about', () => {
    const fields = [{ name: 'Email' }, { name: 'Phone' }];
    expect(suggestPromptFields('Include email, phone excluded.', fields).fields
      .map(({ field }) => field.name)).toEqual(['Email']);
    expect(suggestPromptFields('Form with phone excluded.', fields).fields).toEqual([]);
    expect(suggestPromptFields('Include email, leave out phone.', fields).fields
      .map(({ field }) => field.name)).toEqual(['Email']);
    expect(suggestPromptFields('Include email, phone left out.', fields).fields
      .map(({ field }) => field.name)).toEqual(['Email']);
    // An exclusion further along belongs to the next field, not to this one.
    expect(suggestPromptFields('Include name but exclude phone.', [{ name: 'Name' }, { name: 'Phone' }]).fields
      .map(({ field }) => field.name)).toEqual(['Name']);
  });

  it('reads "everything but X" as an exclusion, the way it reads "everything except X"', () => {
    const fields = [{ name: 'Email' }, { name: 'Phone' }];
    expect(suggestPromptFields('Include everything but phone.', fields).fields).toEqual([]);
    expect(suggestPromptFields('Include all but phone and email.', fields).fields).toEqual([]);
    expect(suggestPromptFields('Include all of them but phone.', fields).fields).toEqual([]);
    // A plain "but" still reverses the polarity instead.
    expect(suggestPromptFields("Don't include phone, but include email.", fields).fields
      .map(({ field }) => field.name)).toEqual(['Email']);
  });

  it('keeps the instruction that precedes an unterminated quote', () => {
    const result = suggestPromptFields('Require "Name and email', [{ name: 'Name' }, { name: 'Email' }]);
    expect(result.fields.map(({ field, required }) => [field.name, required])).toEqual([['Name', true], ['Email', true]]);
  });

  it('does not take the article for the title', () => {
    expect(suggestPromptFields('Make a form with email.', [{ name: 'Email' }]).title).toBeUndefined();
    expect(suggestPromptFields('Make the form.', []).title).toBeUndefined();
    expect(suggestPromptFields('Make a registration form.', []).title).toBe('Registration');
    expect(suggestPromptFields('Create an A Team form with email.', [{ name: 'Email' }]).title).toBe('A Team');
  });

  it('suggests the fields named in the title as well', () => {
    const result = suggestPromptFields('Make a name and email form.', [{ name: 'Name' }, { name: 'Email' }]);
    expect(result.title).toBe('Name and email');
    expect(result.fields.map(({ field }) => field.name)).toEqual(['Name', 'Email']);
  });

  it('reads a requirement negation that follows the field', () => {
    const fields = [{ name: 'Email' }, { name: 'Notes' }];
    expect(suggestPromptFields('Require email, notes not required.', fields).fields
      .map(({ field, required }) => [field.name, required])).toEqual([['Email', true], ['Notes', false]]);
    expect(suggestPromptFields('Require email, notes optional.', fields).fields
      .map(({ field, required }) => [field.name, required])).toEqual([['Email', true], ['Notes', false]]);
    expect(suggestPromptFields("Require email, don't include phone, notes not required.", [
      { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }
    ]).fields.map(({ field, required }) => [field.name, required])).toEqual([['Email', true], ['Notes', false]]);
  });
});
