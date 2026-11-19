import { describe, expect, it } from 'vitest';
import { suggestPromptFields } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/services/fmWebPromptDraft';

const names = (r: { fields: Array<{ field: { name: string } }> }) => r.fields.map((f) => f.field.name);
const pairs = (r: { fields: Array<{ field: { name: string }; required?: boolean }> }) =>
  r.fields.map((f) => [f.field.name, f.required ?? null]);

const simple = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Company' }];

describe('F1 - bare "not" is an exclusion', () => {
  it('F1a: "Include email but not phone." excludes phone', () => {
    const r = suggestPromptFields('Include email but not phone.', simple);
    expect(names(r)).toEqual(['Email']);
  });
  it('F1b: "Require name and email, but not phone." keeps name+email required and drops phone', () => {
    const r = suggestPromptFields('Require name and email, but not phone.', simple);
    expect(pairs(r)).toEqual([['Name', true], ['Email', true]]);
  });
  it('F1c: "Include email, not phone." excludes phone', () => {
    expect(names(suggestPromptFields('Include email, not phone.', simple))).toEqual(['Email']);
  });
});

describe('F2 - coordinated item follows the list head (not the previous item)', () => {
  it('F2a: "Include email, don\'t include phone, and notes." keeps notes with the head', () => {
    const r = suggestPromptFields("Include email, don't include phone, and notes.", simple);
    expect(names(r)).toEqual(['Email', 'Notes']);
  });
  it('F2b: the item is neither dropped nor reported as unmatched', () => {
    const r = suggestPromptFields("Include email, don't include phone, and notes.", simple);
    expect(r.unmatched).toEqual([]);
  });
});

describe('F3 - unterminated quote keeps the instruction before it', () => {
  it('F3a: \'Require "Name and email\' still requires both', () => {
    const r = suggestPromptFields('Require "Name and email', simple);
    expect(pairs(r)).toEqual([['Name', true], ['Email', true]]);
  });
  it('F3b: the same for a plain include', () => {
    expect(names(suggestPromptFields('Include "Name and email', simple))).toEqual(['Name', 'Email']);
  });
});

describe('R1 - emphatic inclusion is not an exclusion', () => {
  it('R1a: "Include not only email but also phone." keeps both', () => {
    expect(names(suggestPromptFields('Include not only email but also phone.', simple))).toEqual(['Email', 'Phone']);
  });
  it('R1b: "Include all the fields, not just email." keeps email', () => {
    expect(names(suggestPromptFields('Include all the fields, not just email.', simple))).toEqual(['Email']);
  });
  it('R1c: "not merely" / "not simply" also stay positive', () => {
    expect(names(suggestPromptFields('Include not merely email but phone.', simple))).toEqual(['Email', 'Phone']);
    expect(names(suggestPromptFields('Include not simply email but phone.', simple))).toEqual(['Email', 'Phone']);
  });
});

describe('R2 - explicit mid-list reversal carries the following item', () => {
  it('R2a: "Don\'t include phone, but include email, and notes." keeps email+notes', () => {
    const r = suggestPromptFields("Don't include phone, but include email, and notes.", simple);
    expect(names(r)).toEqual(['Email', 'Notes']);
  });
  it('R2b: the negated head still excludes phone', () => {
    const r = suggestPromptFields("Don't include phone, but include email, and notes.", simple);
    expect(names(r)).not.toContain('Phone');
  });
  it('R2c: "Don\'t include phone, notes." excludes both (head is negated)', () => {
    expect(suggestPromptFields("Don't include phone, notes.", simple).fields).toEqual([]);
  });
});

describe('R3 - "not required" / "not optional" are requirements, not exclusions', () => {
  it('R3a: "Include email but not required phone." keeps phone as optional', () => {
    const r = suggestPromptFields('Include email but not required phone.', simple);
    expect(pairs(r)).toEqual([['Email', null], ['Phone', false]]);
  });
  it('R3b: "not strictly required" is also optional', () => {
    const r = suggestPromptFields('Include email and not strictly required phone.', simple);
    expect(pairs(r)).toEqual([['Email', null], ['Phone', false]]);
  });
  it('R3c: "not optional" means required', () => {
    const r = suggestPromptFields('Include email and email is not optional.', simple);
    expect(pairs(r)).toEqual([['Email', true]]);
  });
  it('R3d: "Email is not required." marks email optional', () => {
    const r = suggestPromptFields('Include email. Email is not required.', simple);
    expect(pairs(r)).toEqual([['Email', false]]);
  });
});

describe('R4 - exclusion vocabulary', () => {
  it('R4a: excludes / omits / leaving out / except / without / skip', () => {
    expect(names(suggestPromptFields('Make a form that excludes phone and includes email.', simple))).toEqual(['Email']);
    expect(names(suggestPromptFields('Create a form that omits phone. Include email.', simple))).toEqual(['Email']);
    expect(names(suggestPromptFields('Draft a registration form leaving out phone, including email.', simple))).toEqual(['Email']);
    expect(names(suggestPromptFields('Include everything except phone and email.', simple))).toEqual([]);
    expect(names(suggestPromptFields('Include email without phone.', simple))).toEqual(['Email']);
    expect(names(suggestPromptFields('Skip phone and include email.', simple))).toEqual(['Email']);
  });
  it('R4b: positive inflections still include', () => {
    expect(names(suggestPromptFields('Include email including notes.', simple))).toEqual(['Email', 'Notes']);
    expect(names(suggestPromptFields('Collect email, adding notes.', simple))).toEqual(['Email', 'Notes']);
    expect(names(suggestPromptFields('Form asking for email and requires notes.', simple))).toEqual(['Email', 'Notes']);
  });
});

describe('repository rules', () => {
  it('keeps the exact FileMaker name, including surrounding spaces', () => {
    const field = { name: ' Full Name ' };
    const r = suggestPromptFields('Include attendee name.', [field]);
    expect(r.fields[0]?.field).toBe(field);
    expect(r.fields[0]?.field.name).toBe(' Full Name ');
  });
  it('never suggests read-only, global or calculation fields', () => {
    const r = suggestPromptFields('Include email, phone, notes and count.',
      [{ name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Count', kind: 'calculation' }, { name: 'Glob', kind: 'global' }]);
    expect(names(r)).toEqual(['Email', 'Phone', 'Notes']);
  });
  it('leaves ambiguous matches for manual mapping', () => {
    const r = suggestPromptFields('Require email and phone. Include notes.',
      [{ name: ' Email ' }, { name: 'EmailAddress' }, { name: 'Microphone' }, { name: 'Notebook' }]);
    expect(r.fields).toEqual([]);
    expect(r.unmatched).toEqual(['Email', 'Phone', 'Notes']);
  });
});
