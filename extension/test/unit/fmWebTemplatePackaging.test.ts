import { mkdtemp, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The staging script is JavaScript; this test invokes only its exported function.
// @ts-expect-error The packaging script is JavaScript.
import { buildFmWebTemplate } from '../../scripts/build-fmweb-template.mjs';
import {
  PREVIEW_AVAILABLE_CONTEXT_KEY,
  publishPreviewAvailability,
  resolveRuntimeTemplateRoot
} from '../../src/services/fmWebRuntimeGenerator';

const repositoryRoot = path.resolve(__dirname, '../../..');

describe('the packaged extension', () => {
  let installation: string;

  beforeEach(async () => {
    installation = await mkdtemp(path.join(tmpdir(), 'fm-template-'));
  });
  afterEach(async () => {
    await rm(installation, { recursive: true, force: true });
  });

  /** Stage the FM Web template the way the build does, into an installation folder. */
  async function stage(): Promise<string> {
    const root = path.join(installation, 'dist', 'fmweb-template');
    await buildFmWebTemplate(repositoryRoot, root);
    return path.join(root, 'runtime-next');
  }

  it('carries a preview template the extension can find', async () => {
    const staged = await stage();
    expect(await resolveRuntimeTemplateRoot(installation)).toBe(staged);
  });

  it('publishes the preview availability, so the preview commands are offered', async () => {
    await stage();
    const setContext = vi.fn();
    expect(await publishPreviewAvailability(installation, setContext)).toBe(true);
    expect(setContext).toHaveBeenLastCalledWith(PREVIEW_AVAILABLE_CONTEXT_KEY, true);
  });

  it('carries the files the VSIX validation requires', async () => {
    await stage();
    for (const file of [
      'runtime-next/package.json',
      'runtime-next/preview-server.mjs',
      'runtime-next/app/intake/[id]/page.tsx',
      'shared/package.json',
      'shared/src/index.ts',
      'manifest.json'
    ]) {
      await expect(stat(path.join(installation, 'dist', 'fmweb-template', file)), file).resolves.toBeTruthy();
    }
  });
});
