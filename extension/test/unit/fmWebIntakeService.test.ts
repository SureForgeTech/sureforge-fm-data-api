import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FmWebIntakeService } from '../../src/services/fmWebIntakeService';

let root: string;
let trusted: boolean;
function fixture() {
  const project = { getProjectRoot: () => path.join(root, '.fmweb'), getWorkspaceRoot: () => root,
    isWorkspaceTrusted: () => trusted, getLayoutsDirPath: () => path.join(root, '.fmweb', 'layouts'),
    ensureProjectInitialized: vi.fn(async () => { await mkdir(path.join(root, '.fmweb', 'layouts'), { recursive: true }); return {} as never; }) };
  return { service: new FmWebIntakeService(project), project };
}
beforeEach(async () => { root = await mkdtemp(path.join(tmpdir(), 'fmweb-intake-')); trusted = true; });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
describe('saved portal starters', () => {
  it('resolves source repair independently of mapping, environment and presentation validity', async () => {
    const { service } = fixture();const saved = await service.ensureEventStarter();
    await writeFile(saved.definitionPath, JSON.stringify({ ...saved.definition, environmentId: 'production', branding: { accentColor: 'invalid' }, fields: [] }));
    expect(await service.layoutForEdit('event-registration')).toEqual({ id: saved.layout.id, filePath: saved.layoutPath, valid: true });
    await writeFile(saved.layoutPath, '{broken');
    expect((await service.layoutForEdit('event-registration')).valid).toBe(false);
    expect(await readFile(saved.layoutPath, 'utf8')).toBe('{broken');
    await writeFile(saved.layoutPath, JSON.stringify({ ...saved.layout, id: 'c1111111-1111-4111-8111-111111111111' }));
    expect((await service.layoutForEdit('event-registration')).valid).toBe(false);
  });

  it('prepares source metadata before allowing mapped fields and migrates legacy ids', async () => {
    const { service: original, project } = fixture();const saved = await original.ensureEventStarter();
    await writeFile(saved.layoutPath, JSON.stringify({ ...saved.layout, schemaVersion: 0 }));
    expect((await original.load('event-registration')).layout.id).toBe(saved.layout.id);
    const service = new FmWebIntakeService({ ...project, prepareLayout: async (layout) => ({ ...layout, objects: layout.objects.map((object, index) => index || object.type !== 'field' ? object : { ...object, kind: 'calculation' }) }) });
    await expect(service.load('event-registration')).rejects.toThrow('writable');
  });

  it('keeps malformed JSON openable for repair without validation or overwrite', async () => {
    const { service } = fixture();const saved = await service.ensureEventStarter();
    await writeFile(saved.definitionPath, '{broken');
    expect(await service.definitionPathForEdit('event-registration')).toBe(saved.definitionPath);
    await expect(service.load('event-registration')).rejects.toThrow();
    expect(await readFile(saved.definitionPath, 'utf8')).toBe('{broken');
  });
  it('never resumes a different portal when the original file has a changed id and layout', async () => {
    const { service } = fixture();const saved = await service.ensureEventStarter();
    const otherLayout = { ...saved.layout, id: 'c1111111-1111-4111-8111-111111111111' };
    const other = { ...saved.definition, id: 'other', layoutId: otherLayout.id };
    await writeFile(path.join(path.dirname(saved.layoutPath), `${otherLayout.id}.layout.json`), JSON.stringify(otherLayout));
    await writeFile(path.join(path.dirname(saved.definitionPath), 'other.intake.json'), JSON.stringify(other));
    await writeFile(saved.definitionPath, JSON.stringify(other));
    await expect(service.ensureEventStarter()).rejects.toThrow('filename');
  });

  it('creates and resumes exact mapped, credential-free user files without replacing edits', async () => {
    const { service } = fixture();
    const saved = await service.ensureEventStarter();
    expect(saved.definition.fields[0]!.fmFieldName).toBe(' Full Name ');
    expect(saved.layout.fmLayoutName).toBe(' Registrations ');
    const definition = { ...saved.definition, title: 'My event', branding: { organizationName: 'Example team', accentColor: '#CC4411' } };
    await writeFile(saved.definitionPath, JSON.stringify(definition));
    const before = await readFile(saved.layoutPath, 'utf8');
    expect((await service.ensureEventStarter()).definition.title).toBe('My event');
    expect(await readFile(saved.layoutPath, 'utf8')).toBe(before);
    const snapshot = await service.previewFiles();
    expect(JSON.parse(snapshot.intakes.get('event-registration.intake.json')!.toString()).branding.organizationName).toBe('Example team');
    expect(snapshot.layouts.size).toBe(1);
  });
  it('resumes both partial setup states by creating only the missing partner', async () => {
    const { service } = fixture();
    let saved = await service.ensureEventStarter();
    await rm(saved.definitionPath);
    saved = await service.ensureEventStarter();
    await rm(saved.layoutPath);
    expect((await service.ensureEventStarter()).definition.id).toBe(saved.definition.id);
  });
  it('refuses untrusted workspaces before writes and invalid path identifiers', async () => {
    const { service, project } = fixture();trusted = false;
    await expect(service.ensureEventStarter()).rejects.toThrow('trust');
    expect(project.ensureProjectInitialized).not.toHaveBeenCalled();
    await expect(service.load('../escape')).rejects.toThrow('identifier');
    trusted = true;
    expect((await service.previewFiles()).intakes.size).toBe(0);
  });
  it.each(['malformed', 'mismatch', 'live', 'mapping', 'color', 'oversize'])('refuses %s data without overwriting it', async (kind) => {
    const { service } = fixture();const saved = await service.ensureEventStarter();
    const form = { ...saved.definition };
    if (kind === 'mismatch') form.id = 'another';
    if (kind === 'live') form.environmentId = 'production';
    if (kind === 'mapping') form.fields = [{ ...form.fields[0]!, fmFieldName: 'Unmapped' }];
    if (kind === 'color') form.branding = { organizationName: 'X', accentColor: 'url(evil)' };
    const raw = kind === 'malformed' ? '{' : kind === 'oversize' ? ' '.repeat(1048577) : JSON.stringify(form);
    await writeFile(saved.definitionPath, raw);
    await expect(service.ensureEventStarter()).rejects.toThrow();
    await expect(service.previewFiles()).rejects.toThrow();
    expect(await readFile(saved.definitionPath, 'utf8')).toBe(raw);
  });
  it('refuses source and definition links, including an intermediate intake folder link', async () => {
    const { service } = fixture();const saved = await service.ensureEventStarter();
    const outside = path.join(root, 'outside.json');await writeFile(outside, '{}');
    await rm(saved.layoutPath);await symlink(outside, saved.layoutPath);
    await expect(service.load('event-registration')).rejects.toThrow('symbolic link');
    await rm(saved.layoutPath);await service.ensureEventStarter();
    await rm(saved.definitionPath);await symlink(outside, saved.definitionPath);
    await expect(service.ensureEventStarter()).rejects.toThrow('symbolic link');
    await rm(path.dirname(saved.definitionPath), { recursive: true });
    await symlink(root, path.dirname(saved.definitionPath), 'dir');
    await expect(service.previewFiles()).rejects.toThrow('symbolic link');
  });
  it('refuses too many forms before copying anything and does not invent a changed source layout', async () => {
    const { service } = fixture();const saved = await service.ensureEventStarter();
    await writeFile(saved.definitionPath, JSON.stringify({ ...saved.definition, layoutId: 'c1111111-1111-4111-8111-111111111111' }));
    await expect(service.ensureEventStarter()).rejects.toThrow();
    for (let i = 0; i < 50; i++) await writeFile(path.join(path.dirname(saved.definitionPath), `form-${i}.intake.json`), '{}');
    await expect(service.previewFiles()).rejects.toThrow('50');
  });
});
