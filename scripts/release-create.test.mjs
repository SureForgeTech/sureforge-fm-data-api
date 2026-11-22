// Tests for tools/release-create.sh, the rerun-safe release step.
//
// A job cancelled after GitHub published the release cannot be rerun: `gh release create` is not
// idempotent and the server refuses a second release for the same tag. The script publishes the
// release when it does not exist, and completes it when it does.
//
// Run with: node --test scripts/*.test.mjs
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(new URL('../tools/release-create.sh', import.meta.url));

/**
 * A fake GitHub CLI that records every call and keeps the release it reports, so an upload is
 * visible to the next call the way the real CLI behaves. `existing` says what a published
 * release already carries: its asset names and whether it has notes.
 */
function writeFakeGh(directory, { existing = null, uploadFails = false } = {}) {
  const log = path.join(directory, 'gh-calls.log');
  const state = path.join(directory, 'gh-state.json');
  const binary = path.join(directory, 'gh');
  const source = `#!/usr/bin/env node
const { appendFileSync, readFileSync, writeFileSync } = require('node:fs');

const args = process.argv.slice(2);
appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify(args) + '\\n');

const statePath = process.env.FAKE_GH_STATE;
const read = () => {
  try {
    return JSON.parse(readFileSync(statePath, 'utf8'));
  } catch {
    return null;
  }
};
const write = (value) => writeFileSync(statePath, JSON.stringify(value));

if (args[0] === 'release' && args[1] === 'view') {
  const release = read();
  if (!release) {
    process.stderr.write('release not found\\n');
    process.exit(1);
  }
  process.stdout.write(JSON.stringify(release));
} else if (args[0] === 'release' && args[1] === 'create') {
  const assets = args.slice(3).filter((value) => !value.startsWith('--'));
  write({ body: 'notes here', assets: assets.map((name) => ({ name: name.split('/').pop() })) });
  process.stdout.write('https://example.invalid/releases/created\\n');
} else if (args[0] === 'release' && args[1] === 'upload') {
  if (process.env.FAKE_GH_UPLOAD_FAILS) {
    process.stderr.write('upload failed\\n');
    process.exit(1);
  }
  const release = read() ?? { body: '', assets: [] };
  const names = args.slice(3).filter((value) => !value.startsWith('--'));
  for (const name of names) {
    const asset = name.split('/').pop();
    if (!release.assets.some((entry) => entry.name === asset)) release.assets.push({ name: asset });
  }
  write(release);
  process.stdout.write('uploaded\\n');
} else if (args[0] === 'release' && args[1] === 'edit') {
  const release = read() ?? { body: '', assets: [] };
  release.body = 'notes here';
  write(release);
  process.stdout.write('edited\\n');
} else {
  process.stderr.write('fake gh: unexpected call ' + args.join(' ') + '\\n');
  process.exit(1);
}
`;
  writeFileSync(binary, source, 'utf8');
  chmodSync(binary, 0o755);
  if (existing) writeFileSync(state, JSON.stringify(existing), 'utf8');
  return {
    binary,
    log,
    env: {
      FAKE_GH_LOG: log,
      FAKE_GH_STATE: state,
      FAKE_GH_UPLOAD_FAILS: uploadFails ? '1' : ''
    }
  };
}

/** Run the script with a fake GitHub CLI and report what it did. */
function runReleaseCreate({ existing = null, uploadFails = false, assets = ['extension.vsix'], notes = 'notes here' } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'release-create-'));
  const notesFile = path.join(directory, 'notes.md');
  writeFileSync(notesFile, notes, 'utf8');
  const assetPaths = assets.map((name) => {
    const full = path.join(directory, name);
    writeFileSync(full, 'asset', 'utf8');
    return full;
  });
  const fake = writeFakeGh(directory, { existing, uploadFails });
  const result = spawnSync('bash', [scriptPath, 'v1.9.1', notesFile, ...assetPaths], {
    encoding: 'utf8',
    env: { ...process.env, ...fake.env, GH_CLI: fake.binary }
  });
  // The fake GitHub CLI writes its log only when it is called, so a script that stops before that
  // leaves no log at all.
  const calls = existsSync(fake.log)
    ? readFileSync(fake.log, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line))
    : [];
  return { result, calls, directory };
}

test('publishes the release when the tag has none', () => {
  const { result, calls } = runReleaseCreate();
  assert.equal(result.status, 0, result.stderr);
  assert.ok(calls.some((call) => call[0] === 'release' && call[1] === 'create'));
  assert.match(result.stdout, /published v1\.9\.1/);
});

test('does not create a second release when one already exists with every asset', () => {
  const existing = { body: 'notes here', assets: [{ name: 'extension.vsix' }] };
  const { result, calls } = runReleaseCreate({ existing });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(!calls.some((call) => call[0] === 'release' && call[1] === 'create'));
  assert.ok(!calls.some((call) => call[0] === 'release' && call[1] === 'upload'));
  assert.match(result.stdout, /already existed/);
});

test('uploads the assets the existing release is missing', () => {
  const existing = { body: 'notes here', assets: [] };
  const { result, calls } = runReleaseCreate({ existing });
  assert.equal(result.status, 0, result.stderr);
  const upload = calls.find((call) => call[0] === 'release' && call[1] === 'upload');
  assert.ok(upload, 'the missing asset was not uploaded');
  assert.ok(upload.some((value) => value.endsWith('extension.vsix')), 'the missing asset was not named');
  assert.ok(upload.includes('--clobber'));
});

test('sets the notes when the existing release has none', () => {
  const existing = { body: '', assets: [{ name: 'extension.vsix' }] };
  const { result, calls } = runReleaseCreate({ existing });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(calls.some((call) => call[0] === 'release' && call[1] === 'edit'));
});

test('says what is missing when the upload fails', () => {
  const existing = { body: 'notes here', assets: [] };
  const { result } = runReleaseCreate({ existing, uploadFails: true });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /missing 1 asset/);
});

test('refuses to publish a release with no notes', () => {
  const { result, calls } = runReleaseCreate({ notes: '' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /no release notes/);
  assert.equal(calls.length, 0);
});
