import { describe, expect, it } from 'vitest';
import { suggestPromptFields } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/services/fmWebPromptDraft';

const simple = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Company' }];
const names = (r: { fields: Array<{ field: { name: string } }> }) => r.fields.map((f) => f.field.name);

describe('fourth-case check for the list anchor', () => {
  it('"but not X" does not swallow the item that follows it', () => {
    expect(names(suggestPromptFields('Include email, but not phone, and notes.', simple))).toEqual(['Email', 'Notes']);
  });
  it('"but not X" keeps a negated head negated', () => {
    expect(names(suggestPromptFields("Don't include phone, but not email, and notes.", simple))).toEqual([]);
  });
  it('the three documented behaviour decisions hold', () => {
    expect(names(suggestPromptFields("Don't include phone, notes.", simple))).toEqual([]);
    expect(names(suggestPromptFields("Include email, don't include phone, and notes.", simple))).toEqual(['Email', 'Notes']);
    expect(names(suggestPromptFields("Don't include phone, but include email, and notes.", simple))).toEqual(['Email', 'Notes']);
  });
});
