import * as vscode from 'vscode';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFmWebApp } from '../../src/commands/createFmWebApp';
import { registerFmWebProjectCommands } from '../../src/commands/fmWebProject';

vi.mock('../../src/commands/createFmWebApp', () => ({ createFmWebApp: vi.fn(async () => undefined) }));

/** The handler the extension registers for Create FM Web App. */
function handler(): (arg: unknown) => Promise<void> {
  registerFmWebProjectCommands({ context: {} as never, profileStore: {} as never, fmClient: {} as never,
    schemaService: {} as never, fmWebProjectService: {} as never, fmWebRuntimeGenerator: {} as never,
    fmBridgeServer: {} as never, roleGuard: {} as never, logger: { error: vi.fn() } as never, refreshExplorer: vi.fn() });
  return vi.mocked(vscode.commands.registerCommand).mock.calls
    .filter(([id]) => id === 'filemakerDataApiTools.createFmWebApp').pop()![1] as (arg: unknown) => Promise<void>;
}

describe('the Create FM Web App command', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('passes the sample source through, so the editor can go back to the invented data', async () => {
    await handler()({ source: 'sample', changeSource: true, starter: 'event-registration' });
    expect(vi.mocked(createFmWebApp)).toHaveBeenCalledWith(expect.anything(),
      expect.objectContaining({ source: 'sample', changeSource: true, starter: 'event-registration' }));
  });

  it('passes the other two sources through', async () => {
    await handler()({ source: 'filemaker', changeSource: true });
    await handler()({ source: 'draft', changeSource: true });
    const calls = vi.mocked(createFmWebApp).mock.calls;
    expect(calls[0]![1]).toMatchObject({ source: 'filemaker', changeSource: true });
    expect(calls[1]![1]).toMatchObject({ source: 'draft', changeSource: true });
  });

  it('drops a source it does not know', async () => {
    await handler()({ source: 'something else', changeSource: true });
    expect(vi.mocked(createFmWebApp).mock.calls[0]![1]).toMatchObject({ source: undefined, changeSource: true });
  });
});
