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
    expect(result.fields.map(({ field }) => field.name)).toEqual(['Email', 'Notes']);
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

  it('does not remove an included field just because it should not be required', () => {
    const fields = [{ name: 'Phone' }];
    expect(suggestPromptFields('Require "Phone". Do not require "Phone".', fields).fields)
      .toEqual([{ field: fields[0], required: false }]);
    expect(suggestPromptFields('Do not require "Phone".', fields).fields).toEqual([]);
  });

  it('distinguishes collecting a field from requiring it in a coordinated exclusion', () => {
    const fields = [{ name: 'Email' }, { name: 'Phone' }];
    const result = suggestPromptFields('Include "Email". Do not collect "Phone" or require "Email".', fields);
    expect(result.fields).toEqual([{ field: fields[0], required: false }]);
  });

  it('limits prompt size before attempting any match', () => {
    expect(() => suggestPromptFields('x'.repeat(MAX_FORM_PROMPT_LENGTH + 1), [])).toThrow('2,000 characters');
  });
});
