import { mkdir, mkdtemp, rm } from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { describe, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import * as vscode from 'vscode';
import { suggestPromptFields } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/services/fmWebPromptDraft';
import { registrationAppFromFields } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/services/fmWebAppModel';
import { createFmWebApp } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/commands/createFmWebApp';
import { FmWebAppPanel } from '/workspace/sureforge-fm-data-api-wt-567/extension/src/webviews/fmWebApp';

const fields = [{ name: 'Name' }, { name: 'Email' }, { name: 'Phone' }, { name: 'Notes' }, { name: 'Company' }, { name: 'Session' }];
const show = (prompt: string, layout = fields) => {
  const result = suggestPromptFields(prompt, layout);
  return { title: result.title ?? null, fields: result.fields.map((item) => [item.field.name, item.required ?? null]), unmatched: result.unmatched };
};

describe('follow-up probes', () => {
  it('records remaining prompts and the empty-selection error', () => {
    const prompts = [
      'Require attendee name and email, add an optional session',
      'Require attendee name and email, add optional session, notes not required.',
      'Make a name and email form without phone.',
      'Make a name form that does not include email.',
      'Make a company picnic form.',
      'Include notes, not the required email.',
      'Include name not the required email.',
      'Add a session required for new volunteers and email.',
      'Please add phone optional if they want and email.',
      'Include "..." and email.',
      'Require email, notes not required.',
      'notes not required',
      'not required notes',
      'Email is not required.',
      'Email isn\'t required.',
      'Do not include phone, notes.',
      'Include email, don\'t include phone, and notes.',
      'Don\'t include phone, but include email, and notes.',
      'Require email, don\'t include phone, and notes.',
      'Create an A Team form',
      'Make a form.',
      'Make the form with email.',
      'Build an An Evening form.'
    ];
    const lines = prompts.map((prompt) => JSON.stringify(prompt) + '\n  ' + JSON.stringify(show(prompt)));
    const quoted = suggestPromptFields('Include "...".', [{ name: '...' }]);
    lines.push('quoted dots ' + JSON.stringify({ fields: quoted.fields.map((item) => item.field.name), same: quoted.fields[0]?.field.name === '...' }));
    let empty = 'no-throw';
    try { registrationAppFromFields('Layout', []); } catch (error) { empty = (error as Error).message; }
    lines.push('empty selection: ' + empty);
    const spaced = { name: ' Email Address ' };
    const kept = suggestPromptFields('Require email address.', [spaced]);
    lines.push('spaced ' + JSON.stringify({ name: kept.fields[0]?.field.name, same: kept.fields[0]?.field === spaced, required: kept.fields[0]?.required ?? null }));
    writeFileSync('/workspace/.fm-scratch/r5/followup.txt', lines.join('\n') + '\n');
    expect(empty).toMatch(/1 and 100/);
    expect(kept.fields[0]?.field).toBe(spaced);
  });

  it('applies prompt optional against FileMaker-required metadata through the real command', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'fm-r5-'));
    const open = vi.spyOn(FmWebAppPanel, 'open').mockImplementation(() => undefined);
    vi.spyOn(FmWebAppPanel, 'revealIfOpen').mockReturnValue(false);
    (vscode.workspace as { isTrusted: boolean }).isTrusted = true;
    const project = {
      getWorkspaceRoot: () => root,
      getProjectRoot: () => path.join(root, '.fmweb'),
      getLayoutsDirPath: () => path.join(root, '.fmweb', 'layouts'),
      isWorkspaceTrusted: () => true,
      ensureProjectInitialized: vi.fn(async () => undefined),
      setActiveProfile: vi.fn(async () => undefined),
      syncMetadata: vi.fn(async () => undefined)
    };
    const fmClient = {
      listLayouts: vi.fn(async () => ['Registrations']),
      getLayoutMetadata: vi.fn(async () => ({ fieldMetaData: [
        { name: 'Email', type: 'normal', result: 'text', required: true },
        { name: 'Notes', type: 'normal', result: 'text', notEmpty: true },
        { name: 'Phone', type: 'normal', result: 'text' },
        { name: 'Calc', type: 'calculation', result: 'number', required: true }
      ] }))
    };
    vi.mocked(vscode.window.showInputBox).mockResolvedValue('Include optional email, notes not required, and required phone.');
    vi.mocked(vscode.window.showQuickPick).mockImplementation(async (items, options) => {
      const choices = items as unknown as Array<{ label: string; picked?: boolean; field?: { name: string } }>;
      if (options?.canPickMany) return choices.filter((item) => item.picked) as never;
      return choices[0] as never;
    });
    await createFmWebApp({
      context: { extensionUri: { fsPath: '/extension' }, subscriptions: [] },
      project, generator: { getGeneratedRuntimeRoot: () => root },
      profileStore: { listProfiles: vi.fn(async () => [{ id: 'p', name: 'Dev', database: 'Events' }]) },
      fmClient
    } as never, { source: 'draft' });
    const definition = open.mock.calls[0]![1] as { title: string; fields: Array<{ fmFieldName: string; required: boolean }> };
    const picked = (vscode.window.showQuickPick as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .map((call) => call[0]) as Array<Array<{ label: string; picked?: boolean }>>;
    const fieldPick = picked.find((items) => Array.isArray(items) && items.some((item) => item.label === 'Email'));
    const lines = [
      'definition ' + JSON.stringify(definition.fields.map((field) => [field.fmFieldName, field.required])),
      'title ' + JSON.stringify(definition.title),
      'picker ' + JSON.stringify(fieldPick?.map((item) => [item.label, item.picked ?? false]))
    ];
    writeFileSync('/workspace/.fm-scratch/r5/command.txt', lines.join('\n') + '\n');
    await rm(root, { recursive: true, force: true });
    expect(definition.fields.map((field) => field.fmFieldName)).not.toContain('Calc');
  });

  it('empty multi-select throws the writable-field error instead of returning quietly', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'fm-r5b-'));
    await mkdir(root, { recursive: true });
    vi.spyOn(FmWebAppPanel, 'revealIfOpen').mockReturnValue(false);
    const open = vi.spyOn(FmWebAppPanel, 'open').mockImplementation(() => undefined);
    (vscode.workspace as { isTrusted: boolean }).isTrusted = true;
    vi.mocked(vscode.window.showInputBox).mockResolvedValue('Require email');
    vi.mocked(vscode.window.showQuickPick).mockImplementation(async (items, options) => {
      if (options?.canPickMany) return [] as never;
      return (items as unknown[])[0] as never;
    });
    await expect(createFmWebApp({
      context: { extensionUri: { fsPath: '/extension' }, subscriptions: [] },
      project: { getWorkspaceRoot: () => root, getProjectRoot: () => root, getLayoutsDirPath: () => root, isWorkspaceTrusted: () => true },
      generator: { getGeneratedRuntimeRoot: () => root },
      profileStore: { listProfiles: vi.fn(async () => [{ id: 'p', name: 'Dev', database: 'Events' }]) },
      fmClient: {
        listLayouts: vi.fn(async () => ['Registrations']),
        getLayoutMetadata: vi.fn(async () => ({ fieldMetaData: [{ name: 'Email', type: 'normal', result: 'text' }] }))
      }
    } as never, { source: 'draft' })).rejects.toThrow('Choose between 1 and 100 writable, nonglobal fields.');
    expect(open).not.toHaveBeenCalled();
    await rm(root, { recursive: true, force: true });
  });
});
