const verbs = [
  'include', 'includes', 'included', 'including',
  'add', 'adds', 'added', 'adding',
  'collect', 'collects', 'collected', 'collecting',
  'require', 'requires', 'requiring', 'required',
  'ask for', 'asks for', 'asked for', 'asking for',
  'exclude', 'excludes', 'excluded', 'excluding',
  'omit', 'omits', 'omitted', 'omitting',
  'skip', 'skips', 'skipped', 'skipping',
  'without', 'no need for', 'leaving out', 'except'
];
const re = /\b(?:(do not|don t|dont|never|not(?!\s+(?:only|just|merely|simply)\b)(?!\s+(?:\w+\s+)?(?:required|optional)\b))(?:\s+(includ(?:e|es|ed|ing)|add(?:s|ed|ing)?|collect(?:s|ed|ing)?|requir(?:e|es|ing)|ask(?:s|ed|ing)? for))?|(exclud(?:e|es|ed|ing)|omit(?:s|ted|ting)?|without|skip(?:s|ped|ping)?|no(?: need for)?|leaving out|except)|(or\s+)?(but|includ(?:e|es|ed|ing)|add(?:s|ed|ing)?|collect(?:s|ed|ing)?|requir(?:e|es|ing)|ask(?:s|ed|ing)? for))\b/g;
for (const v of verbs) {
  const m = [...v.matchAll(re)];
  console.log(v.padEnd(14), m.length ? 'MATCH ' + JSON.stringify(m.map(x => [x[0], x[1], x[3]])) : 'NO MATCH');
}
console.log('\n-- "required" must NOT be a directive --');
console.log(JSON.stringify([...'required'.matchAll(re)].map(m => m[0])));
console.log('-- "optional" must NOT be a directive --');
console.log(JSON.stringify([...'optional'.matchAll(re)].map(m => m[0])));
