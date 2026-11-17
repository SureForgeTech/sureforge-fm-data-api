import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerFmWebProjectCommands } from '../../src/commands/fmWebProject';
const create = vi.hoisted(() => vi.fn());
const editable = vi.hoisted(() => vi.fn());
const load = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/fmWebIntakeService', () => ({ FmWebIntakeService: class { ensureEventStarter = create; load = load; definitionPathForEdit = editable; } }));
function handler() {
  registerFmWebProjectCommands({ context: {} as never, profileStore: {} as never, fmClient: {} as never,
    schemaService: {} as never, fmWebProjectService: {} as never, fmWebRuntimeGenerator: {} as never,
    fmBridgeServer: {} as never, roleGuard: {} as never, logger: { error: vi.fn() } as never, refreshExplorer: vi.fn() });
  return vi.mocked(vscode.commands.registerCommand).mock.calls.filter(([id]) => id === 'filemakerDataApiTools.buildPortal').pop()![1] as () => Promise<void>;
}
beforeEach(() => {
  vi.clearAllMocks();(vscode.workspace as { isTrusted: boolean }).isTrusted = true;
  const saved = { definitionPath: '/workspace/.fmweb/intakes/event-registration.intake.json', layout: { id: 'source-layout' } };
  create.mockReset().mockResolvedValue(saved);load.mockReset().mockResolvedValue(saved);
  editable.mockReset().mockResolvedValue(saved.definitionPath);
});
afterEach(() => { (vscode.workspace as { isTrusted: boolean }).isTrusted = true; });
describe('Build a Portal guided entry', () => {
  it.each(['create', 'edit'])('opens invalid saved data for repair during %s without replacing it', async (action) => {
    create.mockRejectedValue(new Error('Invalid definition'));load.mockRejectedValue(new Error('Invalid definition'));
    vi.mocked(vscode.window.showQuickPick).mockResolvedValue({ action } as never);
    await handler()();
    expect(editable).toHaveBeenCalledWith('event-registration');
    expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(expect.objectContaining({ fsPath: '/workspace/.fmweb/intakes/event-registration.intake.json' }));
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('repair'));
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
  });

  it('offers a sample journey without a saved profile and stops cleanly on cancel', async () => {
    vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);await handler()();
    expect(create).not.toHaveBeenCalled();expect(load).not.toHaveBeenCalled();
    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ action: 'create' })]), expect.objectContaining({ title: 'Build a Portal' }));
  });
  it('refuses trust before offering actions or writing files', async () => {
    (vscode.workspace as { isTrusted: boolean }).isTrusted = false;await handler()();
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled();
  });
  it.each(['create', 'edit', 'preview', 'layout'])('routes %s through saved data or existing commands', async (action) => {
    vi.mocked(vscode.window.showQuickPick).mockResolvedValue({ action } as never);await handler()();
    if (action === 'create') expect(create).toHaveBeenCalledOnce();else expect(load).toHaveBeenCalledWith('event-registration');
    if (action === 'preview') expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.startFmWebPreviewServer');
    else if (action === 'layout') expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.openLayoutMode', { layoutId: 'source-layout' });
    else expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(expect.objectContaining({ fsPath: '/workspace/.fmweb/intakes/event-registration.intake.json' }));
  });
  it('shows a repairable error for invalid saved data and never starts a preview', async () => {
    load.mockRejectedValue(new Error('Invalid definition'));vi.mocked(vscode.window.showQuickPick).mockResolvedValue({ action: 'preview' } as never);
    await handler()();expect(vscode.window.showErrorMessage).toHaveBeenCalled();expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
  });
});
