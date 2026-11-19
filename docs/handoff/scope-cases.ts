import { suggestPromptFields } from '/workspace/sureforge-fm-data-api-wt-scope/extension/src/services/fmWebPromptDraft';

const fields: any[] = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }];

// [prompt, expected "Field:required" list]
// The expectations come from the independent review of this change.
const cases: Array<[string, string[]]> = [
  // The defect this change fixes.
  ['Name and email are required.', ['Name:true', 'Email:true']],
  ['Name, email, and phone are required.', ['Name:true', 'Email:true', 'Phone:true']],
  ['Make email and phone required.', ['Email:true', 'Phone:true']],
  ['Make email and phone optional.', ['Email:false', 'Phone:false']],
  ['Name and email are optional.', ['Name:false', 'Email:false']],
  ['Make email, phone and notes required.', ['Email:true', 'Phone:true', 'Notes:true']],
  ['Require email, phone and notes are required.', ['Email:true', 'Phone:true', 'Notes:true']],
  ['Email as well as phone are required.', ['Email:true', 'Phone:true']],

  // The reach must stay off the fields it does not cover.
  ['Require email, notes not required.', ['Email:true', 'Notes:false']],
  ['Optional name and email, phone required.', ['Name:false', 'Email:undefined', 'Phone:true']],
  ['Optional name and email, phone are required.', ['Name:false', 'Email:undefined', 'Phone:true']],
  ['Name and email are optional, notes and phone are required.', ['Name:false', 'Email:false', 'Notes:true', 'Phone:true']],
  ['Include email and phone, only email required.', ['Email:true', 'Phone:undefined']],
  ['Include email and phone. Phone required.', ['Email:undefined', 'Phone:true']],
  ['Include email and phone, email is required.', ['Email:true', 'Phone:undefined']],
  ['Include name and email, phone is required.', ['Name:undefined', 'Email:undefined', 'Phone:true']],
  ['Collect name, email, phone is required.', ['Name:undefined', 'Email:undefined', 'Phone:true']],
  ['Include email and phone, email is optional.', ['Email:false', 'Phone:undefined']],

  // A directive names its own fields, so a later requirement does not reach into them.
  ['Include email and phone, notes are required.', ['Email:undefined', 'Phone:undefined', 'Notes:true']],
  ['Include email and phone, notes are optional.', ['Email:undefined', 'Phone:undefined', 'Notes:false']],
  ['Include name and email, phone are required.', ['Name:undefined', 'Email:undefined', 'Phone:true']],
  ['Include email, exclude phone, and notes are required.', ['Email:undefined', 'Notes:true']],
  ['Include email and phone, email and notes are required.', ['Email:true', 'Phone:undefined', 'Notes:true']],
  ['Include name. Add email and phone, exclude name, and notes are required.', ['Email:undefined', 'Phone:undefined', 'Notes:true']],

  // A plain comma list is one phrase, even under a directive.
  ['Include email, phone are required.', ['Email:true', 'Phone:true']],
  ['Include name, email, and phone are required.', ['Name:true', 'Email:true', 'Phone:true']],
  ['Include email, phone, and notes are required.', ['Email:true', 'Phone:true', 'Notes:true']],
  ['Optional email, phone are required.', ['Email:false', 'Phone:true']]
];

let failures = 0;
for (const [prompt, expected] of cases) {
  const got = suggestPromptFields(prompt, fields).fields.map((f) => `${f.field.name}:${f.required}`);
  const ok = JSON.stringify(got) === JSON.stringify(expected);
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${prompt}`);
  if (!ok) console.log(`        expected ${JSON.stringify(expected)}\n        got      ${JSON.stringify(got)}`);
}
console.log(failures === 0 ? `\nALL ${cases.length} CASES PASS` : `\n${failures} of ${cases.length} CASES FAIL`);
