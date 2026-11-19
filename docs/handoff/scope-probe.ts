import { suggestPromptFields } from '/workspace/sureforge-fm-data-api-wt-scope/extension/src/services/fmWebPromptDraft';
const fields: any[] = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }];
for (const p of [
  'Name and email are required.',
  'Name, email, and phone are required.',
  'Make email and phone required.',
  'Require email, notes not required.',
  'Require email and phone.',
  'Name and email are optional, notes and phone are required.',
  'Require email, phone and notes are required.',
  'Include email and phone, only email required.',
  'Make a form with email.'
]) {
  const d = suggestPromptFields(p, fields);
  console.log(JSON.stringify({ p, fields: d.fields.map((f) => `${f.field.name}:${f.required}`) }));
}
