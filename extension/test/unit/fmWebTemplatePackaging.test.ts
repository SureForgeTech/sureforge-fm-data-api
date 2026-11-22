import { mkdir, mkdtemp, rm, stat } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The staging script and the VSIX validation are JavaScript; this test invokes only their exports.
// @ts-expect-error The packaging script is JavaScript.
import { buildFmWebTemplate } from '../../scripts/build-fmweb-template.mjs';
// @ts-expect-error The VSIX validation is JavaScript.
import { REQUIRED_TEMPLATE_FILES } from '../../scripts/validate-vsix.mjs';
import {
  PREVIEW_AVAILABLE_CONTEXT_KEY,
  publishPreviewAvailability,
  resolveRuntimeTemplateRoot
} from '../../src/services/fmWebRuntimeGenerator';

const repositoryRoot = path.resolve(__dirname, '../../..');

describe('the packaged extension', () => {
  let installation: string;
  const parents: string[] = [];

  beforeEach(async () => {
    // The installation sits one folder deeper, so the resolver's parent-folder probe lands
    // inside the temporary tree and cannot find a stray template beside it.
    const parent = await mkdtemp(path.join(tmpdir(), 'fm-template-'));
    installation = path.join(parent, 'ext');
    await mkdir(installation, { recursive: true });
    parents.push(parent);
  });
  afterEach(async () => {
    await rm(installation, { recursive: true, force: true });
    await Promise.all(parents.splice(0).map((parent) => rm(parent, { recursive: true, force: true })));
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
    for (const file of REQUIRED_TEMPLATE_FILES) {
      await expect(stat(path.join(installation, 'dist', 'fmweb-template', file)), file).resolves.toBeTruthy();
    }
  });
});
