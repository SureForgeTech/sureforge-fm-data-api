import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { buildFmWebTemplate } from '../../extension/scripts/build-fmweb-template.mjs';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'fmweb-package-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const name of ['runtime-next/app', 'runtime-next/lib', 'shared/src']) await mkdir(path.join(root, name), { recursive: true });
  for (const name of ['package.json', 'preview-server.mjs', 'proxy.ts', 'next.config.ts', 'next-env.d.ts', 'tsconfig.json', 'vitest.config.ts']) {
    await writeFile(path.join(root, 'runtime-next', name), name.endsWith('.json') ? '{}' : 'export {};\n');
  }
  await writeFile(path.join(root, 'runtime-next/app/page.tsx'), 'export const page = "sample";\n');
  await writeFile(path.join(root, 'runtime-next/lib/public.ts'), 'export const publicValue = true;\n');
  await writeFile(path.join(root, 'shared/package.json'), '{}');
  await writeFile(path.join(root, 'shared/src/index.ts'), 'export const shared = true;\n');
  return { root, output: path.join(root, 'extension/dist/fmweb-template') };
}

test('the packaged FM Web template contains source and matching hashes, with local state excluded', async (t) => {
  const { root, output } = await fixture(t);
  for (const name of ['.env.local', '.npmrc', 'customer-data.json', 'debug.js.map']) {
    await writeFile(path.join(root, 'runtime-next/lib', name), 'synthetic-private-canary');
  }
  for (const name of ['node_modules', 'coverage', 'dist']) {
    await mkdir(path.join(root, 'runtime-next/lib', name));
    await writeFile(path.join(root, 'runtime-next/lib', name, 'private.ts'), 'synthetic-private-canary');
  }
  await writeFile(path.join(root, 'runtime-next/package-lock.json'), '{}');
  const files = await buildFmWebTemplate(root, output);
  assert.ok(files.includes('runtime-next/package-lock.json'));
  assert.ok(files.includes('runtime-next/app/page.tsx'));assert.ok(files.includes('shared/src/index.ts'));
  assert.deepEqual(await readdir(path.join(output, 'runtime-next/lib')), ['public.ts']);
  const manifest = JSON.parse(await readFile(path.join(output, 'manifest.json'), 'utf8'));
  for (const [name, digest] of Object.entries(manifest.files)) {
    const bytes = await readFile(path.join(output, name));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), digest);
    assert.ok(!bytes.toString().includes('synthetic-private-canary'));
  }
});

test('a linked source refuses the build without replacing the previous complete template', async (t) => {
  const { root, output } = await fixture(t);
  await mkdir(output, { recursive: true });await writeFile(path.join(output, 'keep.txt'), 'previous template');
  const outside = path.join(root, 'outside');await mkdir(outside);await writeFile(path.join(outside, 'secret.ts'), 'synthetic-private-canary');
  await symlink(outside, path.join(root, 'runtime-next/lib/linked'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(buildFmWebTemplate(root, output), /symbolic link/);
  assert.equal(await readFile(path.join(output, 'keep.txt'), 'utf8'), 'previous template');
  assert.deepEqual((await readdir(path.dirname(output))).filter((name) => name.startsWith('.fmweb-template-build-')), []);
});

test('a missing required source or a linked output refuses instead of producing a partial kit', async (t) => {
  const { root, output } = await fixture(t);
  await rm(path.join(root, 'runtime-next/preview-server.mjs'));
  await assert.rejects(buildFmWebTemplate(root, output), /ENOENT/);
  await assert.rejects(readFile(path.join(output, 'manifest.json')), /ENOENT/);
  const outside = path.join(root, 'outside');await mkdir(outside);
  await symlink(outside, output, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(buildFmWebTemplate(root, output), /regular directory/);
  assert.deepEqual(await readdir(outside), []);
});
