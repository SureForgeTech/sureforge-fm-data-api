import fs from 'node:fs';
import path from 'node:path';

const EXT = '/workspace/sureforge-fm-data-api-wt-home/extension';
const cat = fs.readFileSync(path.join(EXT, 'src/webviews/home/catalogue.ts'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(EXT, 'package.json'), 'utf8'));
const titles = new Map(manifest.contributes.commands.map((c) => [c.command, c.title]));

const entries = [...cat.matchAll(/id:\s*'([^']+)',\s*\n\s*label:\s*'([^']*)',\s*\n\s*description:\s*'([^']*)',\s*\n\s*command:\s*'([^']+)'/g)]
  .map((m) => ({ id: m[1], label: m[2], description: m[3], command: m[4] }));

const mismatched = entries
  .map((e) => ({ ...e, manifestTitle: titles.get(e.command) }))
  .filter((e) => e.manifestTitle !== e.label);

console.log('entries parsed:', entries.length);
console.log('labels differing from the manifest command title:');
for (const e of mismatched) console.log('  ', e.command, '| label:', JSON.stringify(e.label), '| manifest title:', JSON.stringify(e.manifestTitle));

// Is HomeEntry.id used anywhere outside catalogue.ts?
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.ts')) files.push([p, fs.readFileSync(p, 'utf8')]);
  }
})(path.join(EXT, 'src'));
for (const [p, s] of files) {
  if (p.endsWith('catalogue.ts')) continue;
  for (const m of s.matchAll(/entry\.id|\.id\b/g)) {
    const line = s.slice(0, m.index).split('\n').length;
    console.log('  id usage:', path.relative(EXT, p) + ':' + line, m[0]);
  }
}
for (const [p, s] of files) {
  if (p.endsWith('catalogue.ts')) continue;
  if (/FILEMAKER_HOME_SECTIONS|FILEMAKER_ADVANCED_SECTIONS|HomeEntry|HomeSection/.test(s)) {
    console.log('  catalogue consumer:', path.relative(EXT, p));
  }
}
const testDir = path.join(EXT, 'test');
(function walkT(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkT(p);
    else if (e.name.endsWith('.ts')) {
      const s = fs.readFileSync(p, 'utf8');
      if (/FILEMAKER_HOME_SECTIONS|FILEMAKER_ADVANCED_SECTIONS|HomeEntry/.test(s)) {
        console.log('  catalogue consumer (test):', path.relative(EXT, p));
        for (const m of s.matchAll(/entry\.id|\.id\b/g)) {
          console.log('      id usage:', path.relative(EXT, p) + ':' + s.slice(0, m.index).split('\n').length, m[0]);
        }
      }
    }
  }
})(testDir);
