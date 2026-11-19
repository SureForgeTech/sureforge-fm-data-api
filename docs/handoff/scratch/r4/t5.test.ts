import { it } from 'vitest';
import { writeFileSync, readFileSync } from 'node:fs';
import { suggestPromptFields as cur } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/services/fmWebPromptDraft';
import { suggestPromptFields as prev } from '/workspace/.fm-scratch/r4/prev';
import { suggestPromptFields as alt } from '/workspace/.fm-scratch/r4/alt';
const F = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Company' }];
const P = ['Make a name and email form.', 'Create a name and email form with phone.', 'Make an email form.', 'Create an A Team form with email.', 'Require email, don\'t include phone, notes not required.', 'Require email, notes not required.'];
it('t5', () => {
  const s = P.map(p => { const f = (x: typeof cur) => { const r = x(p, F); return JSON.stringify({ t: r.title, f: r.fields.map(q => [q.field.name, q.required]) }); };
    return `${p}\n  cur  ${f(cur)}\n  prev ${f(prev)}\n  alt  ${f(alt)}`; });
  writeFileSync('/workspace/.fm-scratch/r4/t5.txt', s.join('\n'));
});
