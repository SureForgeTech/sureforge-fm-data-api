const tests = [
  ['plain', /skip/, 'skip'],
  ['with optional', /skip(?:s|ped|ping)/, 'skip'],
  ['with word boundary', /\bskip(?:s|ped|ping)\b/, 'skip'],
  ['group', /\b(skip(?:s|ped|ping))\b/, 'skip'],
  ['alt group', /\b(exclud(?:e|es|ed|ing)|skip(?:s|ped|ping))\b/, 'skip'],
  ['skip plain', /\b(skip)\b/, 'skip'],
  ['skip s', /\b(skip(?:s)?)\b/, 'skip'],
  ['skip ped', /\b(skip(?:ped)?)\b/, 'skip'],
  ['skip ping', /\b(skip(?:ping)?)\b/, 'skip'],
];
for (const [name, re, input] of tests) {
  console.log(name, '->', JSON.stringify(re.exec(input)));
}
console.log('source:', /\b(skip(?:s|ped|ping))\b/.source);
console.log('literal test:', 'skip'.match(/\b(skip(?:s|ped|ping))\b/));
