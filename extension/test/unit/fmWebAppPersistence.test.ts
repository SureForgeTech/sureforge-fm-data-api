import { link, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { eventRegistrationExample } from '@fmweb/shared';
import { FmWebIntakeService } from '../../src/services/fmWebIntakeService';
let root: string;
function service(trusted = true) {
  return new FmWebIntakeService({ getWorkspaceRoot: () => root, getProjectRoot: () => path.join(root, '.fmweb'),
    getLayoutsDirPath: () => path.join(root, '.fmweb', 'layouts'), isWorkspaceTrusted: () => trusted,
    ensureProjectInitialized: vi.fn(async () => { await mkdir(path.join(root, '.fmweb', 'layouts'), { recursive: true });return {} as never; }) });
}
beforeEach(async () => { root = await mkdtemp(path.join(tmpdir(), 'fm-app-save-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
describe('app editor persistence', () => {
  it('creates once, updates a definition without changing the source, and retains a stable revision', async () => {
    const api = service();const app = eventRegistrationExample();const saved = await api.createApp(app.definition, app.layout);
    const source = await readFile(saved.layoutPath, 'utf8');
    const updated = await api.saveApp({ ...saved.definition, title: 'New event', fields: saved.definition.fields.slice(0, 2) }, saved.revision);
    expect(updated.definition.title).toBe('New event');expect(updated.revision).not.toBe(saved.revision);
    expect(await readFile(saved.layoutPath, 'utf8')).toBe(source);
    expect((await api.load('event-registration')).revision).toBe(updated.revision);
    expect((await readdir(path.dirname(saved.definitionPath))).some((name) => name.endsWith('.tmp'))).toBe(false);
    await expect(api.createApp(app.definition, app.layout)).rejects.toMatchObject({ code: 'EEXIST' });
    expect((await api.load('event-registration')).definition.title).toBe('New event');
  });
  it('refuses stale saves and changes to source/target references', async () => {
    const api = service();const app = eventRegistrationExample();const saved = await api.createApp(app.definition, app.layout);
    await writeFile(saved.definitionPath, JSON.stringify({ ...saved.definition, title: 'Edited elsewhere' }));
    await expect(api.saveApp(saved.definition, saved.revision)).rejects.toThrow('changed');
    const current = await api.load('event-registration');
    await expect(api.saveApp({ ...current.definition, environmentId: 'production' }, current.revision)).rejects.toThrow('target');
    await expect(api.saveApp({ ...current.definition, fields: [{ ...current.definition.fields[0]!, fmFieldName: 'Admin' }] }, current.revision)).rejects.toThrow('writable');
    expect((await api.load('event-registration')).definition.title).toBe('Edited elsewhere');
  });
  it('can remove a broken mapping through the editor while preview still refuses it', async () => {
    const api = service();const app = eventRegistrationExample();const saved = await api.createApp(app.definition, app.layout);
    await writeFile(saved.definitionPath, JSON.stringify({ ...saved.definition, fields: [...saved.definition.fields, { ...saved.definition.fields[0], id: 'missing', fmFieldName: 'Missing' }] }));
    await expect(api.load('event-registration')).rejects.toThrow('writable');
    const editing = await api.loadForEditing('event-registration');
    expect((await api.saveApp(saved.definition, editing.revision)).definition.fields).toEqual(saved.definition.fields);
  });
  it('refuses untrusted writes, linked definitions and existing different source files', async () => {
    const app = eventRegistrationExample();await expect(service(false).createApp(app.definition, app.layout)).rejects.toThrow('trust');
    const api = service();const saved = await api.createApp(app.definition, app.layout);
    const alias = path.join(root, 'alias.json');await link(saved.definitionPath, alias);
    await expect(api.saveApp({ ...saved.definition, title: 'Changed' }, saved.revision)).rejects.toThrow('hard links');
    expect(JSON.parse(await readFile(alias, 'utf8')).title).toBe(saved.definition.title);
    await rm(saved.definitionPath);await symlink(alias, saved.definitionPath);
    await expect(api.saveApp(saved.definition, saved.revision)).rejects.toThrow('symbolic link');
  });
});
