import * as vscode from 'vscode';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { registerBatchCommands } from '../../src/commands/batch';

const profile = { id: 'p1', name: 'Dev', database: 'Sales', serverUrl: 'https://fm.example.test' };

type Handler = (arg?: unknown) => Promise<void>;

/** The handler the command registered, so the test can run it. */
function handlerFor(command: string): Handler {
  const call = vi
    .mocked(vscode.commands.registerCommand)
    .mock.calls.find(([name]) => name === command);
  if (!call) throw new Error(`the command ${command} was not registered`);
  return call[1] as Handler;
}

function deps() {
  const batchUpdate = vi.fn(async () => ({
    attempted: 2,
    successCount: 2,
    failureCount: 0,
    warnings: [],
    skippedColumns: [],
    rowsWithModId: 0,
    rowsChecked: 0
  }));
  return {
    batchUpdate,
    profileStore: {
      listProfiles: vi.fn(async () => [profile]),
      getActiveProfileId: vi.fn(() => profile.id),
      getProfile: vi.fn(async () => profile)
    },
    fmClient: { listLayouts: vi.fn(async () => ['Contacts']) },
    batchService: {
      getDefaultBatchUpdateOptions: vi.fn(async () => ({ dryRun: true })),
      batchUpdate
    },
    jobRunner: {
      startJob: vi.fn((_title: string, task: (ctx: unknown) => Promise<void>) => {
        void task({
          log: vi.fn(),
          isCancellationRequested: () => false,
          reportProgress: vi.fn()
        });
        return { id: 'job-1' };
      })
    },
    roleGuard: { assertFeature: vi.fn(async () => true) },
    settingsService: {
      isBatchEnabled: vi.fn(() => true),
      getBatchMaxRecords: vi.fn(() => 1000),
      getBatchConcurrency: vi.fn(() => 1),
      getDateFormats: vi.fn(() => 2),
      isRecordEditEnabled: vi.fn(() => true),
      isEnterpriseModeEnabled: vi.fn(() => false)
    },
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
  };
}

const jsonl = [
  JSON.stringify({ recordId: '1', fieldData: { Name: 'Ada', Created: '02/10/2026' } }),
  JSON.stringify({ recordId: '2', fieldData: { Name: 'Grace', Created: '03/10/2026' } })
].join('\n');

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(vscode.workspace.fs.readFile).mockResolvedValue(
    Buffer.from(jsonl) as never
  );
  vi.mocked(vscode.window.showOpenDialog).mockResolvedValue([
    { fsPath: '/tmp/contacts.jsonl', path: '/tmp/contacts.jsonl' }
  ] as never);
  vi.mocked(vscode.window.showTextDocument).mockResolvedValue(undefined as never);
});

describe('the batch update import', () => {
  it('offers the developer the shape the file looks like, and reads it that way', async () => {
    const d = deps();
    registerBatchCommands(d as never);
    const picks: string[] = [];
    vi.mocked(vscode.window.showQuickPick).mockImplementation(async (items) => {
      const choices = items as unknown as Array<{ label: string }>;
      // The first pick is the shape of the file; the second is the mode.
      if (choices.some((choice) => /JSONL/.test(choice.label))) {
        picks.push('shape');
        return choices[0] as never;
      }
      picks.push('mode');
      return choices[0] as never;
    });

    await handlerFor('filemakerDataApiTools.batchUpdateFromFile')({
      profileId: profile.id,
      layout: 'Contacts'
    });

    expect(picks).toEqual(['shape', 'mode']);
    const offered = vi.mocked(vscode.window.showQuickPick).mock.calls[0]![0] as unknown as Array<{
      label: string;
    }>;
    expect(offered.map((choice) => choice.label).join(' | ')).toMatch(/JSONL/);
    // The file was read as JSONL, so both records reached the job.
    expect(d.batchUpdate).toHaveBeenCalledWith(
      profile,
      'Contacts',
      expect.arrayContaining([expect.objectContaining({ recordId: '1' })]),
      expect.anything(),
      expect.anything()
    );
  });

  it('says which date order the server will read the dates in, beside the preview', async () => {
    const d = deps();
    registerBatchCommands(d as never);
    vi.mocked(vscode.window.showQuickPick).mockImplementation(async (items) => {
      const choices = items as unknown as Array<{ label: string }>;
      if (choices.some((choice) => /JSONL/.test(choice.label))) return choices[0] as never;
      return choices[0] as never;
    });

    await handlerFor('filemakerDataApiTools.batchUpdateFromFile')({
      profileId: profile.id,
      layout: 'Contacts'
    });

    // The mode picker says which order the dates are read in.
    const modePick = vi.mocked(vscode.window.showQuickPick).mock.calls[1]![1] as
      | { placeHolder?: string }
      | undefined;
    expect(modePick?.placeHolder).toMatch(/ISO 8601/);
    // The preview carries it too.
    const opened = vi.mocked(vscode.workspace.openTextDocument).mock.calls[0]![0] as {
      content: string;
    };
    expect(opened.content).toMatch(/"dateFormat": 2/);
    expect(opened.content).toMatch(/"dateFormatLabel": "ISO 8601"/);
  });

  it('reads nothing when the developer cancels the shape', async () => {
    const d = deps();
    registerBatchCommands(d as never);
    vi.mocked(vscode.window.showQuickPick).mockImplementation(async (items) => {
      const choices = items as unknown as Array<{ label: string }>;
      const cancel = choices.find((choice) => /Cancel/.test(choice.label));
      return (cancel ?? choices[0]) as never;
    });

    await handlerFor('filemakerDataApiTools.batchUpdateFromFile')({
      profileId: profile.id,
      layout: 'Contacts'
    });

    expect(d.batchUpdate).not.toHaveBeenCalled();
    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringMatching(/cancelled/i)
    );
  });
});
