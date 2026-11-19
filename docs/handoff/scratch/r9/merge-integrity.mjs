import { execFileSync } from 'node:child_process';

const REPO = '/workspace/sureforge-fm-data-api-wt-home';
const g = (args) => execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8' });

const MAIN = 'c0c90b1';
const HEAD = '40a56eb';
const BRANCH_POINT = g(['merge-base', '854d663', MAIN]).trim();

const changedOnMain = g(['diff', '--name-only', BRANCH_POINT, MAIN]).split('\n').filter(Boolean);
const identical = [];
const different = [];
const missingAtHead = [];

for (const file of changedOnMain) {
  let mainBlob;
  let headBlob;
  try {
    mainBlob = g(['rev-parse', `${MAIN}:${file}`]).trim();
  } catch {
    mainBlob = null; // deleted on main
  }
  try {
    headBlob = g(['rev-parse', `${HEAD}:${file}`]).trim();
  } catch {
    headBlob = null;
  }
  if (mainBlob === null) {
    if (headBlob === null) identical.push(`${file} (deleted on main, absent at head)`);
    else different.push(`${file} (deleted on main, still present at head)`);
    continue;
  }
  if (headBlob === null) {
    missingAtHead.push(file);
    continue;
  }
  if (mainBlob === headBlob) identical.push(file);
  else different.push(file);
}

console.log('merge base of the branch point and main:', BRANCH_POINT);
console.log('files changed on main since the branch point:', changedOnMain.length);
console.log('identical at head (main not reverted):', identical.length);
console.log('DIFFERENT at head:', different.length, different);
console.log('MISSING at head:', missingAtHead.length, missingAtHead);
console.log('\nper-file detail for the different ones:');
for (const file of different) {
  console.log('---', file);
  console.log(g(['diff', '--stat', MAIN, HEAD, '--', file]).trim() || '(no diff)');
}
