import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { suggestPromptFields } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/services/fmWebPromptDraft';

const simple = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Company' }];
const names = (r: { fields: Array<{ field: { name: string } }> }) => r.fields.map((f) => f.field.name);
const pairs = (r: { fields: Array<{ field: { name: string }; required?: boolean }> }) =>
  r.fields.map((f) => `${f.field.name}:${f.required ?? null}`);

describe('observed behaviour of the reported edge cases (asserted as observed)', () => {
  it('C1: a postfix exclusion is not read as an exclusion', () => {
    const r = suggestPromptFields('Include email, phone excluded.', simple);
    writeFileSync('/workspace/.fm-scratch/r3/c1.txt', JSON.stringify({ fields: pairs(r), unmatched: r.unmatched }) + '\n');
    expect(names(r)).toEqual(['Email', 'Phone']);        // phone is SUGGESTED although the prompt excludes it
  });
  it('C1b: "leaves out" is not in the vocabulary (only "leaving out")', () => {
    const r = suggestPromptFields('Form that leaves out phone.', simple);
    expect(names(r)).toEqual(['Phone']);
  });
  it('C2: "everything but X" suggests X', () => {
    const r = suggestPromptFields('Include everything but phone.', simple);
    writeFileSync('/workspace/.fm-scratch/r3/c2.txt', JSON.stringify({ fields: pairs(r), unmatched: r.unmatched }) + '\n');
    expect(names(r)).toEqual(['Phone']);
  });
  it('C3: "Do not require X" drops X from the suggestions and from unmatched', () => {
    const r = suggestPromptFields('Do not require phone.', simple);
    writeFileSync('/workspace/.fm-scratch/r3/c3.txt', JSON.stringify({ fields: pairs(r), unmatched: r.unmatched }) + '\n');
    expect(r.fields).toEqual([]);
    expect(r.unmatched).toEqual([]);
  });
  it('C3b: the adjective form of the same intent keeps the field as optional', () => {
    const r = suggestPromptFields('Include email but not required phone.', simple);
    expect(pairs(r)).toEqual(['Email:null', 'Phone:false']);
  });
  it('C4: a mid-list exclusion ends the requirement scope of the coordinated item', () => {
    const withExclusion = suggestPromptFields("Require email, don't include phone, and notes.", simple);
    const withoutExclusion = suggestPromptFields('Require email, and notes.', simple);
    writeFileSync('/workspace/.fm-scratch/r3/c4.txt', JSON.stringify({
      withExclusion: pairs(withExclusion), withoutExclusion: pairs(withoutExclusion)
    }) + '\n');
    expect(pairs(withExclusion)).toEqual(['Email:true', 'Notes:null']);
    expect(pairs(withoutExclusion)).toEqual(['Email:true', 'Notes:true']);
  });
  it('C5: "Make a form ..." produces the title "A"', () => {
    const r = suggestPromptFields('Make a form with email.', simple);
    writeFileSync('/workspace/.fm-scratch/r3/c5.txt', JSON.stringify({ title: r.title }) + '\n');
    expect(r.title).toBe('A');
  });
  it('C5b: the title capture can also swallow a field mention', () => {
    const r = suggestPromptFields('Make a name form with email.', simple);
    expect(r.title).toBe('Name');
    expect(names(r)).toEqual(['Email']);   // the Name field the prompt asked for is not suggested
  });
});
