import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerFmWebProjectCommands } from '../../src/commands/fmWebProject';
const create = vi.hoisted(() => vi.fn());
const layoutEdit = vi.hoisted(() => vi.fn());
const editable = vi.hoisted(() => vi.fn());
const load = vi.hoisted(() => vi.fn());
vi.mock('../../src/services/fmWebIntakeService', () => ({ FmWebIntakeService: class { ensureEventStarter = create; ensureStarter = create; load = load; definitionPathForEdit = editable; layoutForEdit = layoutEdit; } }));
/** The command asks for the starter first and the action second. */
function pick(action: string, starterId = 'event-registration') {
  vi.mocked(vscode.window.showQuickPick)
    .mockResolvedValueOnce({ label: 'Event Registration', starter: { id: starterId } } as never)
    .mockResolvedValueOnce({ action } as never);
}
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
  layoutEdit.mockReset().mockResolvedValue({ id: 'source-layout', filePath: '/workspace/.fmweb/layouts/source.layout.json', valid: true });
});
afterEach(() => { (vscode.workspace as { isTrusted: boolean }).isTrusted = true; });
describe('Build a Portal guided entry', () => {
  it('opens source Layout Mode when a mapping is invalid, without full form validation', async () => {
    load.mockRejectedValue(new Error('Invalid mapping'));
    pick('layout');
    await handler()();expect(load).not.toHaveBeenCalled();
    expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.openLayoutMode', { layoutId: 'source-layout' });
  });
  it('opens malformed source JSON directly for repair instead of sending it into the designer', async () => {
    layoutEdit.mockResolvedValue({ id: 'source-layout', filePath: '/workspace/.fmweb/layouts/source.layout.json', valid: false });
    pick('layout');
    await handler()();expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
    expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(expect.objectContaining({ fsPath: '/workspace/.fmweb/layouts/source.layout.json' }));
  });

  it.each(['create', 'edit'])('opens invalid saved data for repair during %s without replacing it', async (action) => {
    create.mockRejectedValue(new Error('Invalid definition'));load.mockRejectedValue(new Error('Invalid definition'));
    pick(action);
    await handler()();
    expect(editable).toHaveBeenCalledWith('event-registration');
    expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(expect.objectContaining({ fsPath: '/workspace/.fmweb/intakes/event-registration.intake.json' }));
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(expect.stringContaining('repair'));
    expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
  });

  it('offers a sample journey without a saved profile and stops cleanly on cancel', async () => {
    // The starter is chosen and the action is cancelled: nothing is written.
    vi.mocked(vscode.window.showQuickPick)
      .mockResolvedValueOnce({ label: 'Event Registration', starter: { id: 'event-registration' } } as never)
      .mockResolvedValueOnce(undefined);
    await handler()();
    expect(create).not.toHaveBeenCalled();expect(load).not.toHaveBeenCalled();
    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ action: 'create' })]), expect.objectContaining({ title: 'Build a Portal' }));
  });
  it('offers the starters the wizard offers, not only the event registration', async () => {
    vi.mocked(vscode.window.showQuickPick).mockResolvedValue(undefined);await handler()();
    expect(vscode.window.showQuickPick).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ label: 'Event Registration' }),
      expect.objectContaining({ label: 'Feedback or Request Form' }),
      expect.objectContaining({ label: 'Service Inquiry' }),
      expect.objectContaining({ label: 'Appointment Request' }),
      expect.objectContaining({ label: 'Application' })
    ]), expect.objectContaining({ title: 'Build a Portal · Starter' }));
  });
  it('works on the starter the user picked', async () => {
    pick('create', 'service-inquiry');await handler()();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: 'service-inquiry' }));
    pick('edit', 'service-inquiry');await handler()();
    expect(editable).toHaveBeenCalledWith('service-inquiry');
    pick('preview', 'service-inquiry');await handler()();
    expect(load).toHaveBeenCalledWith('service-inquiry');
    pick('layout', 'service-inquiry');await handler()();
    expect(layoutEdit).toHaveBeenCalledWith('service-inquiry');
  });
  it('refuses trust before offering actions or writing files', async () => {
    (vscode.workspace as { isTrusted: boolean }).isTrusted = false;await handler()();
    expect(vscode.window.showQuickPick).not.toHaveBeenCalled();expect(create).not.toHaveBeenCalled();
  });
  it.each(['create', 'edit', 'preview', 'layout', 'export'])('routes %s through saved data or existing commands', async (action) => {
    pick(action);await handler()();
    if (action === 'create') expect(create).toHaveBeenCalledOnce();else if (action === 'layout') expect(layoutEdit).toHaveBeenCalledWith('event-registration');else expect(load).toHaveBeenCalledWith('event-registration');
    if (action === 'preview') expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.startFmWebPreviewServer', { intakeId: 'event-registration' });
    else if (action === 'export') expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.generateFmWebNextApp');
    else if (action === 'layout') expect(vscode.commands.executeCommand).toHaveBeenCalledWith('filemakerDataApiTools.openLayoutMode', { layoutId: 'source-layout' });
    else expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(expect.objectContaining({ fsPath: '/workspace/.fmweb/intakes/event-registration.intake.json' }));
  });
  it('shows a repairable error for invalid saved data and never starts a preview', async () => {
    load.mockRejectedValue(new Error('Invalid definition'));pick('preview');
    await handler()();expect(vscode.window.showErrorMessage).toHaveBeenCalled();expect(vscode.commands.executeCommand).not.toHaveBeenCalled();
  });
});
