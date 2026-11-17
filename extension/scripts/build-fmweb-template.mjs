// Stage only source needed by the FM Web runtime. No environment files, dependencies or local build output ship.
import { mkdir, readdir, readFile, lstat, rm, rename, writeFile } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function buildFmWebTemplate(repositoryRoot, outputRoot) {
  const parent = path.dirname(outputRoot);
  await mkdir(parent, { recursive: true });
  if ((await lstat(parent)).isSymbolicLink()) throw new Error('The template output parent must not be a symbolic link.');
  const existing = await lstat(outputRoot).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  if (existing?.isSymbolicLink() || (existing && !existing.isDirectory())) throw new Error('The template output must be a regular directory.');
  const staging = path.join(parent, `.fmweb-template-build-${randomUUID()}`);
  const hashes = {};
  async function copy(relative) {
    const source = path.join(repositoryRoot, relative);
    const info = await lstat(source);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Template source must be a regular file: ${relative}`);
    const bytes = await readFile(source);
    const target = path.join(staging, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: 'wx' });
    hashes[relative.replaceAll(path.sep, '/')] = createHash('sha256').update(bytes).digest('hex');
  }
  async function sourceTree(relative) {
    const source = path.join(repositoryRoot, relative);
    const info = await lstat(source);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Template source must be a regular directory: ${relative}`);
    for (const entry of (await readdir(source, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.') || ['node_modules', 'dist', 'coverage'].includes(entry.name)) continue;
      const nested = path.join(relative, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Template source must not contain symbolic links: ${nested}`);
      if (entry.isDirectory()) await sourceTree(nested);
      else if (entry.isFile() && /\.(?:ts|tsx|mts|mjs|css|svg|png|ico)$/.test(entry.name)) await copy(nested);
    }
  }
  try {
    await mkdir(staging);
    for (const name of ['package.json', 'preview-server.mjs', 'proxy.ts', 'next.config.ts', 'next-env.d.ts', 'tsconfig.json', 'vitest.config.ts']) {
      await copy(path.join('runtime-next', name));
    }
    const lockfile = await lstat(path.join(repositoryRoot, 'runtime-next', 'package-lock.json')).catch((error) => { if (error.code !== 'ENOENT') throw error; });
    if (lockfile) await copy(path.join('runtime-next', 'package-lock.json'));
    await sourceTree(path.join('runtime-next', 'app'));
    await sourceTree(path.join('runtime-next', 'lib'));
    await copy(path.join('shared', 'package.json'));
    await sourceTree(path.join('shared', 'src'));
    await writeFile(path.join(staging, 'manifest.json'), `${JSON.stringify({ schemaVersion: 1, files: hashes }, null, 2)}\n`);
    await rm(outputRoot, { recursive: true, force: true });
    await rename(staging, outputRoot);
    return Object.keys(hashes);
  } finally { await rm(staging, { recursive: true, force: true }); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const extensionRoot = path.resolve(import.meta.dirname, '..');
  const files = await buildFmWebTemplate(path.dirname(extensionRoot), process.argv[2] ? path.resolve(process.argv[2]) : path.join(extensionRoot, 'dist', 'fmweb-template'));
  console.log(`Staged ${files.length} FM Web template source files.`);
}
