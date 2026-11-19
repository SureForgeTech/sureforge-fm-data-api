import { mkdir, mkdtemp, rm } from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFmWebApp } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/commands/createFmWebApp';
import { FmWebAppPanel } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/webviews/fmWebApp';

let root: string;
let open: ReturnType<typeof vi.spyOn>;
function fixture() {
  const project = {
    getWorkspaceRoot: () => root,
    getProjectRoot: () => path.join(root, '.fmweb'),
    getLayoutsDirPath: () => path.join(root, '.fmweb', 'layouts'),
    isWorkspaceTrusted: () => true,
    ensureProjectInitialized: vi.fn(async () => { await mkdir(path.join(root, '.fmweb', 'layouts'), { recursive: true }); return {} as never; }),
    setActiveProfile: vi.fn(async () => undefined),
    syncMetadata: vi.fn(async () => undefined)
  };
  const fmClient = {
    listLayouts: vi.fn(async () => [' Registrations ']),
    getLayoutMetadata: vi.fn(async () => ({ fieldMetaData: [
      { name: ' Full Name ', type: 'normal', result: 'text' },
      { name: 'Email', type: 'normal', result: 'text' },
      { name: 'Calc', type: 'calculation', result: 'number' },
      { name: 'Global', type: 'normal', result: 'text', global: true }
    ] }))
  };
  const profile = { id: 'profile', name: 'Dev', database: 'Events' };
  const deps = {
    context: { extensionUri: { fsPath: '/extension' }, subscriptions: [] },
    project,
    generator: { getGeneratedRuntimeRoot: () => path.join(root, '.fmweb/generated/runtime-next') },
    profileStore: { listProfiles: vi.fn(async () => [profile]) },
    fmClient
  };
  return { deps, project, fmClient };
}
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'fm-r3-create-')); vi.clearAllMocks();
  (vscode.workspace as { isTrusted: boolean }).isTrusted = true;
  vi.spyOn(FmWebAppPanel, 'revealIfOpen').mockReturnValue(false);
  open = vi.spyOn(FmWebAppPanel, 'open').mockImplementation(() => undefined);
});
afterEach(async () => { vi.restoreAllMocks(); await rm(root, { recursive: true, force: true }); });

function pickFileMaker(emptySelection = false) {
  vi.mocked(vscode.window.showQuickPick).mockImplementation(async (items, options) => {
    const choices = items as unknown as Array<Record<string, unknown>>;
    if (options?.canPickMany) return (emptySelection ? [] : choices) as never;
    return choices[0] as never;
  });
}

describe('F4: empty field selection', () => {
  it('surfaces the field-count error when the user confirms an empty selection (filemaker path)', async () => {
    const { deps } = fixture(); pickFileMaker(true);
    await expect(createFmWebApp(deps as never)).rejects.toThrow('Choose between 1 and 100 writable, nonglobal fields.');
    expect(open).not.toHaveBeenCalled();
  });

  it('surfaces the field-count error when the user confirms an empty selection (draft path)', async () => {
    const { deps } = fixture();
    vi.mocked(vscode.window.showInputBox).mockResolvedValue('Require email');
    vi.mocked(vscode.window.showQuickPick).mockImplementation(async (items, options) => {
      const choices = items as unknown as Array<Record<string, unknown>>;
      if (options?.canPickMany) return [] as never;
      return choices[0] as never;
    });
    await expect(createFmWebApp(deps as never, { source: 'draft' })).rejects.toThrow('Choose between 1 and 100 writable, nonglobal fields.');
    expect(open).not.toHaveBeenCalled();
  });

  it('returns silently when the picker is cancelled (undefined)', async () => {
    const { deps } = fixture();
    vi.mocked(vscode.window.showQuickPick).mockImplementation(async (items, options) => {
      const choices = items as unknown as Array<Record<string, unknown>>;
      if (options?.canPickMany) return undefined as never;
      return choices[0] as never;
    });
    await expect(createFmWebApp(deps as never)).resolves.toBeUndefined();
    expect(open).not.toHaveBeenCalled();
  });
});
