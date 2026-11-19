const base = require('/tmp/opencode/fm-2026-11-18/base.cjs').suggestPromptFields;
const head = require('/tmp/opencode/fm-2026-11-18/head.cjs').suggestPromptFields;
const F = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }];
const CASES = require('/tmp/opencode/fm-2026-11-18/cases.json');
let same = 0, diff = 0;
for (const [prompt, expected] of CASES) {
  const b = base(prompt, F).fields.map(f => `${f.field.name}:${f.required}`);
  const h = head(prompt, F).fields.map(f => `${f.field.name}:${f.required}`);
  const exp = expected.map(x => x.replace('undefined', 'undefined'));
  const bOk = JSON.stringify(b) === JSON.stringify(expected.map(x => x));
  const hOk = JSON.stringify(h) === JSON.stringify(expected);
  if (bOk) same++; else diff++;
  console.log(`${bOk ? 'same-on-base' : 'DISCRIMINATING'} | head ${hOk ? 'OK ' : 'BAD'} | ${prompt}`);
  if (!hOk) console.log(`    expected ${JSON.stringify(expected)}\n    got      ${JSON.stringify(h)}`);
}
console.log(`\n${same} also pass on base, ${diff} discriminate the new behaviour`);
