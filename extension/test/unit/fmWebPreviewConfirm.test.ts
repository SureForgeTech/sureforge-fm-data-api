import * as vscode from 'vscode';
import { eventRegistrationExample } from '@fmweb/shared';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerFmWebProjectCommands } from '../../src/commands/fmWebProject';
import { GenerationCancelledError, GenerationSkippedError } from '../../src/services/generatedFileWriter';

const portalExport = vi.hoisted(() => vi.fn(async () => [] as string[]));
const portalSnapshot = vi.hoisted(() => vi.fn(async () => ({ intakes: new Map<string, Buffer>(), layouts: new Map<string, Buffer>() })));
vi.mock('../../src/services/fmWebIntakeService', () => ({ FmWebIntakeService: class { previewFiles = portalSnapshot; exportSnapshot = portalExport; } }));

const processStart = vi.hoisted(() => vi.fn(async () => undefined));
const processDispose = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('../../src/services/fmWebPreviewProcess', () => ({
  FmWebPreviewProcess: class { start = processStart; dispose = processDispose; },
  previewInstallDescription: (files: Map<string, Buffer>) => files.has('package-lock.json') ? 'npm ci --ignore-scripts' : 'npm install --ignore-scripts',
  PREVIEW_DEV_DESCRIPTION: 'node preview-server.mjs (Next.js development server on 127.0.0.1:3000)'
}));

/** The preview asks before running npm in a private template copy. */

function start() {
  const generator = {
    inspectPreviewFiles: vi.fn(async () => [] as string[]),
    removePreviewFiles: vi.fn(async () => undefined),
    previewTemplateFiles: vi.fn(async () => new Map()),
    generateRuntimeAppTemplate: vi.fn(async () => ({ created: [] as string[], updated: [] as string[], skipped: [] as string[], needsManualUpdate: [] as string[] })),
    listLayoutDefinitions: vi.fn(async (): Promise<Array<{ id: string; name: string }>> => []),
    generateLayoutPage: vi.fn(async (): Promise<{ outputPath: string }> => ({ outputPath: '' })),
    writeBridgeEnv: vi.fn(async () => undefined),
    clearBridgeEnv: vi.fn(async () => undefined),
    getGeneratedRuntimeRoot: () => '/workspace/.fmweb/generated/runtime-next'
  };
  const terminal = { show: vi.fn(), sendText: vi.fn() };
  (vscode.window as unknown as { createTerminal: unknown }).createTerminal = vi.fn(() => terminal);

  const bridge = {
    setRegistrationHandler: vi.fn(),
    ensureStarted: vi.fn(async () => ({ baseUrl: 'http://127.0.0.1:1234' })),
    getSessionToken: () => 'session-token',
    stop: vi.fn(async () => undefined)
  };

  registerFmWebProjectCommands({
    context: { globalStorageUri: { fsPath: '/tmp/registration-command-test-storage' } } as never,
    profileStore: { getActiveProfileId: () => 'p1', getProfile: async () => ({ id: 'p1', name: 'Registration QA', database: 'Events', authMode: 'direct', serverUrl: 'https://fm.example.com/fmi' }) } as never,
    fmClient: { createRecord: vi.fn(), getLayoutMetadata: async () => ({ fieldMetaData: eventRegistrationExample().definition.fields.map((field) => ({ name: field.fmFieldName, type: 'normal', result: 'text' })) }) } as never,
    schemaService: {} as never,
    fmWebProjectService: { getWorkspaceRoot: () => '/workspace', readProjectConfig: async () => ({ activeProfileId: 'p1' }) } as never,
    fmWebRuntimeGenerator: generator as never,
    fmBridgeServer: bridge as never,
    roleGuard: { getFeatureGuard: () => ({ allowed: true }), assertFeature: vi.fn(async () => true) } as never,
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
    refreshExplorer: vi.fn()
  });

  const registered = vi.mocked(vscode.commands.registerCommand).mock.calls.filter(
    ([id]) => id === 'filemakerDataApiTools.startFmWebPreviewServer'
  );
  const handler = registered[registered.length - 1]?.[1] as (arg?: unknown) => Promise<void>;
  const regenerate = vi.mocked(vscode.commands.registerCommand).mock.calls.filter(([id]) => id === 'filemakerDataApiTools.generateFmWebNextApp').pop()?.[1] as () => Promise<void>;
  return { run: handler, regenerate, terminal, generator, bridge };
}

describe('FM Web preview', () => {
  it('reports completed runtime generation and edited-file warnings when only portal data export is cancelled', async () => {
    const { regenerate, generator } = start();
    generator.generateRuntimeAppTemplate.mockResolvedValueOnce({ created: ['app/page.tsx'], updated: [], skipped: [], needsManualUpdate: ['shared/src/index.ts'] });
    portalExport.mockRejectedValueOnce(new GenerationCancelledError());
    await regenerate();
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('1 created'));
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expect.stringContaining('Only portal data export was cancelled'));
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('shared/src/index.ts'));
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
  });

  it('keeps edited normal layout artifacts skipped while passing portal sources separately', async () => {
    const id = 'a1111111-1111-4111-8111-111111111111';
    const source = Buffer.from('{"source":"portal"}');
    portalSnapshot.mockResolvedValueOnce({
      intakes: new Map([['event-registration.intake.json', Buffer.from('{}')]]), layouts: new Map([[`${id}.layout.json`, source]])
    });
    try {
      const { run, generator } = start();
      generator.listLayoutDefinitions.mockResolvedValueOnce([{ id, name: 'Normal record view' }]);
      generator.generateLayoutPage.mockRejectedValueOnce(new GenerationSkippedError('edited layout'));
      vi.mocked(vscode.window.showWarningMessage).mockImplementation(async (_message, ...items) => items.includes('Run' as never) ? 'Run' as never : undefined);
      await run();
      expect(generator.generateLayoutPage).toHaveBeenCalledWith(id);
      const args = processStart.mock.calls.at(-1) as unknown as [unknown, Map<string, Buffer>, unknown, unknown, unknown, Map<string, Buffer>, Map<string, Buffer>];
      expect(args[1].has(`${id}.layout.json`)).toBe(false);
      expect(args[6].get(`${id}.layout.json`)).toBe(source);
    } finally { portalSnapshot.mockReset().mockResolvedValue({ intakes: new Map(), layouts: new Map() }); }
  });

  it('validates portal export before inspecting or changing runtime files', async () => {
    const { regenerate, generator } = start();
    portalSnapshot.mockRejectedValueOnce(new Error('Cannot export portal definition "broken.intake.json".'));
    await regenerate();
    expect(portalSnapshot).toHaveBeenCalledWith('export');
    expect(generator.inspectPreviewFiles).not.toHaveBeenCalled();
    expect(generator.removePreviewFiles).not.toHaveBeenCalled();
    expect(generator.generateRuntimeAppTemplate).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Cannot export portal definition'), 'Details…', 'Copy as Bug Report');
  });

  let directory: string | undefined;
  afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); directory = undefined; });
  beforeEach(() => {
    vi.clearAllMocks();
    portalSnapshot.mockReset().mockResolvedValue({ intakes: new Map(), layouts: new Map() });
    portalExport.mockReset().mockResolvedValue([]);
    (vscode.workspace as unknown as { isTrusted: boolean }).isTrusted = true;
  });

  it('A3 asks before starting the bridge or writing its token, and clears an existing session on cancel', async () => {
    const { run, generator, bridge } = start();
    vi.mocked(vscode.window.showWarningMessage).mockImplementationOnce(async () => {
      expect(bridge.ensureStarted).not.toHaveBeenCalled();
      expect(generator.writeBridgeEnv).not.toHaveBeenCalled();
      return undefined;
    });
    await run();
    expect(bridge.ensureStarted).not.toHaveBeenCalled();
    expect(generator.writeBridgeEnv).not.toHaveBeenCalled();
    expect(bridge.stop).toHaveBeenCalledOnce();
    expect(generator.clearBridgeEnv).toHaveBeenCalledOnce();
  });

  it('shows what will run and does nothing when declined', async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(undefined as never);
    const { run, terminal } = start();

    await run();

    const prompt = vi.mocked(vscode.window.showWarningMessage).mock.calls[0]?.[0] as string;
    expect(prompt).toContain('npm install');
    expect(prompt).toContain('node preview-server.mjs');
    expect(prompt).toContain('/workspace/.fmweb/generated/runtime-next');
    expect(prompt).toContain('package.json');
    expect(vscode.window.createTerminal).not.toHaveBeenCalled();
    expect(terminal.sendText).not.toHaveBeenCalled();
  });

  it('A1 pins the preview launch to loopback after the user agrees', async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('Run' as never);
    const { run, terminal } = start();

    await run();

    expect(terminal.sendText).not.toHaveBeenCalled();
    expect(processStart).toHaveBeenCalledWith(expect.any(Map), expect.any(Map), 'http://127.0.0.1:1234', 'session-token', 'https://fm.example.com/fmi', expect.any(Map), expect.any(Map));
  });

  it('enables real submissions only after a modal names the approved connection and layout', async () => {
    const app = eventRegistrationExample();
    const intakes = new Map([['event-registration.intake.json', Buffer.from(JSON.stringify(app.definition))]]);
    const layouts = new Map([[`${app.layout.id}.layout.json`, Buffer.from(JSON.stringify(app.layout))]]);
    portalSnapshot.mockResolvedValueOnce({ intakes, layouts });
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('Enable FileMaker saves' as never);
    const { run, bridge } = start();await run({ intakeId: 'event-registration', registrationMode: 'filemaker' });
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('REAL FILEMAKER SAVES'), { modal: true }, 'Enable FileMaker saves');
    const prompt = String(vi.mocked(vscode.window.showWarningMessage).mock.calls[0]?.[0]);expect(prompt).toContain('Registration QA');expect(prompt).toContain('Events');expect(prompt).toContain(' Registrations ');
    expect(prompt).toContain('fm.example.com');for (const field of app.definition.fields) expect(prompt).toContain(field.fmFieldName);
    expect(bridge.setRegistrationHandler).toHaveBeenCalledOnce();
    expect(processStart).toHaveBeenCalledWith(expect.any(Map), expect.any(Map), 'http://127.0.0.1:1234', 'session-token', 'https://fm.example.com/fmi', intakes, layouts, 'event-registration', 'filemaker');
  });
  it('does not enable FileMaker writes if the confirmation is declined', async () => {
    const app = eventRegistrationExample();portalSnapshot.mockResolvedValueOnce({ intakes: new Map([['event-registration.intake.json', Buffer.from(JSON.stringify(app.definition))]]), layouts: new Map([[`${app.layout.id}.layout.json`, Buffer.from(JSON.stringify(app.layout))]]) });
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(undefined);const { run, bridge } = start();
    await run({ intakeId: 'event-registration', registrationMode: 'filemaker' });
    expect(bridge.setRegistrationHandler).not.toHaveBeenCalled();expect(processStart).not.toHaveBeenCalled();
  });
  it('passes the explicitly selected saved intake as the eighth private preview argument', async () => {
    const intakes = new Map([['event-registration.intake.json', Buffer.from('{"id":"event-registration"}')]]);
    const layouts = new Map([['a1111111-1111-4111-8111-111111111111.layout.json', Buffer.from('{}')]]);
    portalSnapshot.mockResolvedValueOnce({ intakes, layouts });
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('Run' as never);
    const { run } = start();

    await run({ intakeId: 'event-registration' });

    expect(processStart).toHaveBeenCalledExactlyOnceWith(expect.any(Map), expect.any(Map),
      'http://127.0.0.1:1234', 'session-token', 'https://fm.example.com/fmi', intakes, layouts, 'event-registration');
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
  });

  it('rejects a selected intake absent from the saved snapshot without starting preview', async () => {
    portalSnapshot.mockResolvedValueOnce({
      intakes: new Map([['another-app.intake.json', Buffer.from('{}')]]), layouts: new Map()
    });
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('Run' as never);
    const { run } = start();

    await run({ intakeId: 'event-registration' });

    expect(processStart).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(expect.stringContaining('Choose an existing app to preview.'), 'Details…', 'Copy as Bug Report');
    expect(vscode.window.showInformationMessage).not.toHaveBeenCalled();
  });

  it('passes bridge credentials only to the private process, leaving runtime env files untouched', async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('Run' as never);
    const { run, generator } = start();

    await run();

    expect(generator.writeBridgeEnv).not.toHaveBeenCalled();
    expect(processStart).toHaveBeenCalledWith(expect.any(Map), expect.any(Map), 'http://127.0.0.1:1234', 'session-token', 'https://fm.example.com/fmi', expect.any(Map), expect.any(Map));
  });

  it('warns once about a previous stop failure and still starts the next preview', async () => {
    const { run } = start();
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('Run' as never);
    await run();
    processDispose.mockRejectedValueOnce(new Error('Could not stop the preview process tree.'));
    await run();
    expect(processStart).toHaveBeenCalledTimes(2);
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    expect(vi.mocked(vscode.window.showWarningMessage).mock.calls.filter(([message]) => String(message).includes('Could not stop the previous preview'))).toHaveLength(1);
  });

  it('warns about skipped edited or linked layouts and launches with the remaining layouts', async () => {
    const { run, generator } = start();
    directory = await mkdtemp(path.join(tmpdir(), 'fmweb-preview-confirm-'));
    const outputPath = path.join(directory, 'good.layout.json');
    await writeFile(outputPath, '{"name":" Exact good layout "}');
    generator.listLayoutDefinitions.mockResolvedValue([
      { id: 'edited', name: ' Edited layout ' }, { id: 'good', name: ' Exact good layout ' }, { id: 'linked', name: ' Linked layout ' }
    ]);
    generator.generateLayoutPage.mockRejectedValueOnce(new GenerationSkippedError('edited.layout.json'))
      .mockResolvedValueOnce({ outputPath }).mockRejectedValueOnce(new GenerationSkippedError('linked.layout.json'));
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('Run' as never);
    await run();
    expect(processStart).toHaveBeenCalledWith(expect.any(Map), new Map([['good.layout.json', Buffer.from('{"name":" Exact good layout "}')]]), expect.any(String), expect.any(String), 'https://fm.example.com/fmi', expect.any(Map), expect.any(Map));
    const warnings = vi.mocked(vscode.window.showWarningMessage).mock.calls.map(([message]) => String(message));
    expect(warnings.some((message) => message.includes('skipped') && message.includes(' Edited layout ') && message.includes(' Linked layout '))).toBe(true);
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
  });

  it('still reports unexpected layout-generation failures instead of silently skipping them', async () => {
    const { run, generator } = start();
    generator.listLayoutDefinitions.mockResolvedValue([{ id: 'bad', name: 'Bad' }]);
    generator.generateLayoutPage.mockRejectedValueOnce(new Error('Invalid layout data'));
    await run();
    expect(processStart).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).toHaveBeenCalled();
  });

  it('warns when an edited generated file could not be updated, so a silent failure is not left to the user', async () => {
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(undefined as never);
    const { run, generator } = start();
    generator.inspectPreviewFiles.mockResolvedValue(['lib/bridge-client.ts']);

    await run();

    const messages = vi.mocked(vscode.window.showWarningMessage).mock.calls.map((call) => String(call[0]));
    expect(messages.some((message) => message.includes('lib/bridge-client.ts') && message.includes('ignored'))).toBe(true);
  });

  it('shows ignored files in the run confirmation and leaves them untouched when cancelled', async () => {
    const { run, generator, bridge } = start();
    generator.inspectPreviewFiles.mockResolvedValue(['.npmrc', 'next.config.ts', 'node_modules']);
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(undefined as never);
    await run();
    expect(processStart).not.toHaveBeenCalled();
    expect(bridge.ensureStarted).not.toHaveBeenCalled();
    expect(generator.removePreviewFiles).not.toHaveBeenCalled();
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('node_modules'), { modal: true }, 'Run');
  });

  it('runs a clean template copy despite added or edited files, without generating or deleting runtime files', async () => {
    const { run, generator } = start();
    generator.inspectPreviewFiles.mockResolvedValue(['.npmrc', '.env.local', 'app/user-page.tsx', 'next.config.ts']);
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('Run' as never);
    await run();
    expect(generator.removePreviewFiles).not.toHaveBeenCalled();
    expect(generator.generateRuntimeAppTemplate).not.toHaveBeenCalled();
    expect(generator.writeBridgeEnv).not.toHaveBeenCalled();
    expect(generator.previewTemplateFiles).toHaveBeenCalledOnce();
    expect(processStart).toHaveBeenCalledOnce();
    const prompt = vi.mocked(vscode.window.showWarningMessage).mock.calls[0]![0];
    expect(prompt).toContain('Your runtime files are left untouched');
    expect(prompt).toContain('app/user-page.tsx');
  });

  it('deletes listed runtime files only in the explicit generation command after named confirmation', async () => {
    const { regenerate, generator } = start();
    generator.inspectPreviewFiles.mockResolvedValue(['.npmrc']);
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue('Regenerate from template' as never);
    await regenerate();
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('.npmrc'), { modal: true }, 'Regenerate from template');
    expect(generator.removePreviewFiles).toHaveBeenCalledWith(['.npmrc']);
    expect(generator.generateRuntimeAppTemplate).toHaveBeenCalledOnce();
    expect(processStart).not.toHaveBeenCalled();
  });

  it('preserves runtime files when explicit regeneration is declined', async () => {
    const { regenerate, generator } = start();
    generator.inspectPreviewFiles.mockResolvedValue(['app/user-page.tsx']);
    vi.mocked(vscode.window.showWarningMessage).mockResolvedValue(undefined as never);
    await regenerate();
    expect(generator.removePreviewFiles).not.toHaveBeenCalled();
    expect(generator.generateRuntimeAppTemplate).not.toHaveBeenCalled();
  });

  it('refuses in an untrusted workspace without asking', async () => {
    (vscode.workspace as unknown as { isTrusted: boolean }).isTrusted = false;
    const { run, terminal } = start();

    await run();

    expect(terminal.sendText).not.toHaveBeenCalled();
    expect(vi.mocked(vscode.window.showWarningMessage).mock.calls[0]?.[0]).toMatch(/Workspace trust is required/);
  });
});
