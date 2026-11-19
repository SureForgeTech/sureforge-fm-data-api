import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { suggestPromptFields } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/services/fmWebPromptDraft';

describe('parser result for the command prompt', () => {
  it('records the parser flags before the command overwrites them', () => {
    const layout = [
      { name: 'Email', required: true },
      { name: 'Notes', required: true },
      { name: 'Phone' }
    ];
    const prompt = 'Include optional email, notes not required, and required phone.';
    const result = suggestPromptFields(prompt, layout);
    const text = JSON.stringify({
      fields: result.fields.map((item) => [item.field.name, item.required ?? null, item.field.required ?? null]),
      unmatched: result.unmatched
    });
    writeFileSync('/workspace/.fm-scratch/r5/parser-command-prompt.txt', text + '\n');
    expect(result.fields.map((item) => item.field.name)).toEqual(['Email', 'Notes', 'Phone']);
  });
});
