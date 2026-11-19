import fs from 'node:fs';
import path from 'node:path';

const EXT = '/workspace/sureforge-fm-data-api-wt-home/extension';

const cat = fs.readFileSync(path.join(EXT, 'src/webviews/home/catalogue.ts'), 'utf8');
const ids = [...new Set([...cat.matchAll(/command:\s*'([^']+)'/g)].map((m) => m[1]))];

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.ts')) files.push([p, fs.readFileSync(p, 'utf8')]);
  }
})(path.join(EXT, 'src'));
const all = files.map(([, s]) => s).join('\n');

const missing = ids.filter((id) => !all.includes(`registerCommand('${id}'`));
const contributed = new Set(JSON.parse(fs.readFileSync(path.join(EXT, 'package.json'), 'utf8')).contributes.commands.map((c) => c.command));
const notContributed = ids.filter((id) => !contributed.has(id));

const out = {
  catalogueCommandCount: ids.length,
  notRegisteredInSource: missing,
  notContributedInManifest: notContributed,
  startHereRegistered: all.includes("registerCommand('filemakerDataApiTools.startHere'"),
  // every contributed command in the manifest must be registered somewhere
  contributedButNotRegistered: [...contributed].filter((id) => !all.includes(`registerCommand('${id}'`))
};
fs.writeFileSync('/workspace/.fm-scratch/r9/catalogue-check.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
