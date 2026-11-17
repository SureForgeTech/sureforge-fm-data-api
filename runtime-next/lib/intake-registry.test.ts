import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eventRegistrationExample } from './registration-example';
import { PreviewIntakeRegistry } from './intake-registry';
let root: string;
const example = eventRegistrationExample();
const id = example.definition.id;
async function files() {
  await mkdir(path.join(root, 'intakes'));await mkdir(path.join(root, 'layouts'));
  const form = path.join(root, 'intakes', `${id}.intake.json`);
  const layout = path.join(root, 'layouts', `${example.layout.id}.layout.json`);
  await writeFile(form, JSON.stringify({ ...example.definition, title: 'Saved custom event' }));
  await writeFile(layout, JSON.stringify(example.layout));return { form, layout };
}
beforeEach(async () => { root = await mkdtemp(path.join(tmpdir(), 'fmweb-registry-')); });
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
describe('private portal definition registry', () => {
  it('loads built-in starter only when there is no saved intake folder', async () => {
    const registry = new PreviewIntakeRegistry(root);
    expect((await registry.load(id))?.definition.title).toBe(example.definition.title);
    for (const target of ['../escape', 'Unknown', 'a'.repeat(65), 'other']) expect(await registry.load(target)).toBeUndefined();
  });
  it('loads saved mappings and branding, derives the view, and snapshots them until restart', async () => {
    const { form } = await files();const registry = new PreviewIntakeRegistry(root);
    const loaded = await registry.load(id);
    expect(loaded?.definition.title).toBe('Saved custom event');
    expect(loaded?.layout.objects[0]).toMatchObject({ fmFieldName: ' Full Name ', accessibleLabel: 'Your name' });
    await writeFile(form, '{}');expect(await registry.load(id)).toBe(loaded);
    expect(await new PreviewIntakeRegistry(root).load(id)).toBeUndefined();
  });
  it.each(['malformed', 'oversize', 'mismatch', 'live', 'mapping', 'missing', 'directory', 'formLink', 'layoutLink', 'folderLink'])('fails closed for %s definitions instead of hiding errors with the built-in form', async (kind) => {
    const { form, layout } = await files();
    if (kind === 'malformed') await writeFile(form, '{');
    if (kind === 'oversize') await writeFile(form, ' '.repeat(1048577));
    if (['mismatch', 'live', 'mapping'].includes(kind)) {
      const value = JSON.parse(await readFile(form, 'utf8'));
      if (kind === 'mismatch') value.id = 'other';
      if (kind === 'live') value.environmentId = 'production';
      if (kind === 'mapping') value.fields[0].fmFieldName = 'Unmapped';
      await writeFile(form, JSON.stringify(value));
    }
    if (kind === 'missing') await rm(layout);
    if (kind === 'directory') { await rm(form);await mkdir(form); }
    if (kind === 'formLink') { await rm(form);await symlink(layout, form); }
    if (kind === 'layoutLink') { await rm(layout);await symlink(form, layout); }
    if (kind === 'folderLink') { await rm(path.dirname(form), { recursive: true });await symlink(root, path.dirname(form), 'dir'); }
    expect(await new PreviewIntakeRegistry(root).load(id)).toBeUndefined();
  });
  it('bounds cached target state without evicting an existing form snapshot', async () => {
    const registry = new PreviewIntakeRegistry(root);
    const loaded = await registry.load(id);
    for (let i = 0; i < 55; i++) await registry.load(`form-${i}`);
    expect(await registry.load('last')).toBeUndefined();expect(await registry.load(id)).toBe(loaded);
  });
});
