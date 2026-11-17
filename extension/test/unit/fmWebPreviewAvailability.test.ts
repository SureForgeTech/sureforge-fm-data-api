import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { readFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/fmWebIntakeService', () => ({ FmWebIntakeService: class { async previewFiles() { return { intakes: new Map(), layouts: new Map() }; } } }));

import { registerFmWebProjectCommands } from '../../src/commands/fmWebProject';
import {
  PREVIEW_AVAILABLE_CONTEXT_KEY,
  RuntimeTemplateUnavailableError,
  publishPreviewAvailability,
  resolveRuntimeTemplateRoot
} from '../../src/services/fmWebRuntimeGenerator';

const extensionDir = path.resolve(__dirname, '../..');
const manifest = JSON.parse(readFileSync(path.join(extensionDir, 'package.json'), 'utf8')) as {
  contributes: { commandPalette: Array<{ command: string; when?: string }>; menus: Record<string, Array<{ command: string; when?: string }>> };
};

/** Commands require a complete template, from the packaged kit or a source development installation. */
const NEEDS_TEMPLATE = ['filemakerDataApiTools.generateFmWebNextApp', 'filemakerDataApiTools.startFmWebPreviewServer'];

describe('preview commands are hidden when the installation has no runtime template', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'fmweb-avail-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('is computed the way the generator finds the template (the repository layout and an extension-local copy count; an empty folder does not)', async () => {
    expect(await resolveRuntimeTemplateRoot(extensionDir, true)).toBe(path.resolve(extensionDir, '..', 'runtime-next'));

    const marketplace = path.join(dir, 'ext');
    await mkdir(marketplace, { recursive: true });
    expect(await resolveRuntimeTemplateRoot(marketplace)).toBeUndefined();

    await mkdir(path.join(marketplace, 'runtime-next'), { recursive: true });
    expect(await resolveRuntimeTemplateRoot(marketplace)).toBeUndefined(); // a folder without package.json is not a template
    await writeFile(path.join(marketplace, 'runtime-next', 'package.json'), '{}');
    expect(await resolveRuntimeTemplateRoot(marketplace)).toBe(path.join(marketplace, 'runtime-next'));
  });

  it('sets the context key to false for a Marketplace layout and true for the repository layout', async () => {
    const setContext = vi.fn();
    const marketplace = path.join(dir, 'ext');
    await mkdir(marketplace, { recursive: true });

    expect(await publishPreviewAvailability(marketplace, setContext)).toBe(false);
    expect(setContext).toHaveBeenLastCalledWith(PREVIEW_AVAILABLE_CONTEXT_KEY, false);

    expect(await publishPreviewAvailability(extensionDir, setContext, true)).toBe(true);
    expect(setContext).toHaveBeenLastCalledWith(PREVIEW_AVAILABLE_CONTEXT_KEY, true);
  });

  it('prefers a complete bundled kit in an installed extension and refuses a partial kit', async () => {
    const installed = path.join(dir, 'installed');
    const root = path.join(installed, 'dist/fmweb-template');
    await mkdir(path.join(root, 'runtime-next'), { recursive: true });
    await writeFile(path.join(root, 'runtime-next/package.json'), '{}');
    expect(await resolveRuntimeTemplateRoot(installed)).toBeUndefined();
    await writeFile(path.join(root, 'runtime-next/preview-server.mjs'), 'export {};');
    await mkdir(path.join(root, 'shared/src'), { recursive: true });
    await writeFile(path.join(root, 'shared/package.json'), '{}');
    await writeFile(path.join(root, 'shared/src/index.ts'), 'export {};');
    expect(await resolveRuntimeTemplateRoot(installed)).toBe(path.join(root, 'runtime-next'));
    // An unrelated sibling cannot shadow the template in an installed VSIX.
    await mkdir(path.join(dir, 'runtime-next'));await writeFile(path.join(dir, 'runtime-next/package.json'), '{}');
    expect(await resolveRuntimeTemplateRoot(installed)).toBe(path.join(root, 'runtime-next'));
    expect(await resolveRuntimeTemplateRoot(installed, true)).toBe(path.join(dir, 'runtime-next'));
    const setContext = vi.fn();
    expect(await publishPreviewAvailability(installed, setContext)).toBe(true);
    expect(setContext).toHaveBeenLastCalledWith(PREVIEW_AVAILABLE_CONTEXT_KEY, true);
  });

  it('treats an unreadable location as unavailable instead of throwing', async () => {
    const setContext = vi.fn();
    const unreadable = path.join(dir, '\0bad', 'extension');
    // The parent-template probe must remain unreadable too: path normalization can remove
    // a lone bad component and accidentally discover a template in the working directory.
    expect(path.join(unreadable, '..', 'runtime-next', 'package.json')).toContain('\0');
    expect(await publishPreviewAvailability(unreadable, setContext)).toBe(false);
    expect(setContext).toHaveBeenCalledWith(PREVIEW_AVAILABLE_CONTEXT_KEY, false);
  });

  it('the Command Palette entries of the template-dependent commands require the key (and the project)', () => {
    expect(PREVIEW_AVAILABLE_CONTEXT_KEY).toBe('filemaker.fmWebPreviewAvailable');
    for (const command of NEEDS_TEMPLATE) {
      const entry = (manifest.contributes.menus.commandPalette ?? []).find((item) => item.command === command);
      expect(entry?.when, command).toContain(PREVIEW_AVAILABLE_CONTEXT_KEY);
      expect(entry?.when, command).toContain('filemaker.fmWebProjectInitialized');
    }
  });

  it('no other menu offers these commands without the key', () => {
    for (const [menu, items] of Object.entries(manifest.contributes.menus)) {
      for (const item of items.filter((entry) => NEEDS_TEMPLATE.includes(entry.command))) {
        expect(item.when, `${menu}: ${item.command}`).toContain(PREVIEW_AVAILABLE_CONTEXT_KEY);
      }
    }
  });

  it('Layout Mode and layout-page generation do not need the template, so they stay available', () => {
    for (const command of ['filemakerDataApiTools.openLayoutMode', 'filemakerDataApiTools.generateFmWebLayoutPage']) {
      const entry = (manifest.contributes.menus.commandPalette ?? []).find((item) => item.command === command);
      expect(entry?.when, command).not.toContain(PREVIEW_AVAILABLE_CONTEXT_KEY);
    }
  });

  it('activation publishes the key (extension.ts calls publishPreviewAvailability with the extension folder)', () => {
    const source = readFileSync(path.join(extensionDir, 'src', 'extension.ts'), 'utf8');
    expect(source).toMatch(/publishPreviewAvailability\(\s*context\.extensionUri\.fsPath/);
  });

  describe('invoked another way (keybinding, command link, API) in an installation without the template', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      (vscode.workspace as unknown as { isTrusted: boolean }).isTrusted = true;
    });

    function register(generateRuntimeAppTemplate: () => Promise<unknown>) {
      const createTerminal = vi.fn();
      const inspectPreviewFiles = vi.fn(generateRuntimeAppTemplate);
      const stop = vi.fn(async () => undefined);
      const ensureStarted = vi.fn();
      (vscode.window as unknown as { createTerminal: unknown }).createTerminal = createTerminal;
      registerFmWebProjectCommands({
        context: {} as never,
        profileStore: {} as never,
        fmClient: {} as never,
        schemaService: {} as never,
        fmWebProjectService: {} as never,
        // Inspection now resolves the template before generation can run.
        fmWebRuntimeGenerator: { generateRuntimeAppTemplate, inspectPreviewFiles } as never,
        fmBridgeServer: { stop, ensureStarted } as never,
        roleGuard: { assertFeature: vi.fn(async () => true) } as never,
        logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
        refreshExplorer: vi.fn()
      });
      const handler = (id: string) =>
        vi.mocked(vscode.commands.registerCommand).mock.calls.filter(([name]) => name === id).pop()?.[1] as () => Promise<void>;
      return Object.assign(handler, { createTerminal, inspectPreviewFiles, stop, ensureStarted });
    }

    for (const command of NEEDS_TEMPLATE) {
      it(`${command} says plainly that the preview is not available here`, async () => {
        const handler = register(async () => {
          throw new RuntimeTemplateUnavailableError();
        });
        await handler(command)();
        const shown = vi.mocked(vscode.window.showErrorMessage).mock.calls.map((call) => String(call[0])).join('\n');
        expect(shown).toMatch(/not available in this installation/);
        expect(shown).toMatch(/missing its runtime-next and shared template packages/);
        expect(handler.createTerminal).not.toHaveBeenCalled();
        expect(handler.ensureStarted).not.toHaveBeenCalled();
        expect(vscode.window.showWarningMessage).not.toHaveBeenCalled();
        if (command === 'filemakerDataApiTools.startFmWebPreviewServer') {
          expect(handler.inspectPreviewFiles).toHaveBeenCalledOnce();
          expect(handler.stop).toHaveBeenCalledTimes(2); // initial shutdown and error cleanup
        }
      });
    }
  });
});
