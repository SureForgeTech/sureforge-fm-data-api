import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { suggestPromptFields as cur } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/services/fmWebPromptDraft';
const F = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Company' }];
const P = ['Require email and not strictly required phone.', 'Include email, not strictly required phone.', 'Include email, excludes phone.', 'Include email, omits phone.', 'Include email, leaving out phone.', 'Include email, except phone.', 'Include email and not phone.', 'Include email. Do not require phone.', 'Require email, but optional phone.', 'Make a form with name and email. Leave phone out.'];
it('t6', () => {
  writeFileSync('/workspace/.fm-scratch/r4/t6.txt', P.map(p => { const r = cur(p, F); return `${p}\n  ${JSON.stringify({ t: r.title, f: r.fields.map(q => [q.field.name, q.required]), u: r.unmatched })}`; }).join('\n'));
});
