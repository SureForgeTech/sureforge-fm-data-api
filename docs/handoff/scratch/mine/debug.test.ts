import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { suggestPromptFields } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/services/fmWebPromptDraft';

describe('debug', () => {
  it('shows clause-level detail', () => {
    const out: string[] = [];
    for (const prompt of [
      'Draft a registration form leaving out phone, including email.',
      'Draft a registration form leaving out phone, include email.',
      'Draft a registration form, leaving out phone, include email.',
      'Make a form that excludes phone and includes email.'
    ]) {
      const r = suggestPromptFields(prompt, [{ name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }]);
      out.push(`${JSON.stringify(prompt)}\n  fields=${JSON.stringify(r.fields.map((f) => [f.field.name, f.required ?? null]))} unmatched=${JSON.stringify(r.unmatched)}`);
    }
    writeFileSync('/workspace/.fm-artifacts/debug.txt', out.join('\n') + '\n');
    expect(out.length).toBe(4);
  });
});
