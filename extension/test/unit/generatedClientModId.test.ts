import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { runInNewContext } from 'vm';
import * as ts from 'typescript6';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGenService } from '../../src/services/typeGenService';

interface GeneratedClient {
  editContacts(recordId: string, fieldData: unknown, options?: { modId?: string }): Promise<unknown>;
}

describe('the generated client and the record version', () => {
  let root: string;
  let makeClient: (fetch: typeof globalThis.fetch) => GeneratedClient;
  let clientSource: string;
  let typesSource: string;
  let readmeSource: string;

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'fm-client-modid-'));
    const service = new TypeGenService(
      { getLayoutSchema: async () => ({ supported: true, fields: [] }) } as never,
      {} as never,
      { debug() {}, info() {}, warn() {}, error() {} }
    );
    const artifacts = await service.generateTypeScriptClient(
      { id: 'p', name: 'Test', database: 'DB' } as never,
      ['Contacts'],
      root
    );
    clientSource = await readFile(artifacts.clientPath, 'utf8');
    typesSource = await readFile(artifacts.typesPath, 'utf8');
    readmeSource = await readFile(artifacts.readmePath, 'utf8');
    const compiled = ts.transpileModule(clientSource, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    });
    const exports: Record<string, new (config: unknown) => GeneratedClient> = {};
    runInNewContext(compiled.outputText, { exports });
    makeClient = (fetch) => new exports.FileMakerDataApiClient!({
      serverUrl: 'https://fm.example',
      database: 'DB',
      token: 'token',
      fetch
    });
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('sends the record version with the edit when the developer gives one', async () => {
    let body: unknown;
    const client = makeClient(async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ response: { recordId: '1', modId: '8' }, messages: [{ code: '0', message: 'OK' }] }), { status: 200 });
    });

    const result = await client.editContacts('1', { Name: 'Ada' }, { modId: '7' });

    expect(body).toEqual({ fieldData: { Name: 'Ada' }, modId: '7' });
    expect(result).toEqual({ recordId: '1', modId: '8' });
  });

  it('sends no version when the developer gives none', async () => {
    let body: unknown;
    const client = makeClient(async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ response: { recordId: '1', modId: '8' }, messages: [{ code: '0', message: 'OK' }] }), { status: 200 });
    });

    await client.editContacts('1', { Name: 'Ada' });

    expect(body).toEqual({ fieldData: { Name: 'Ada' } });
    expect(Object.hasOwn(body as object, 'modId')).toBe(false);
  });

  it('declares the option in the generated types', () => {
    expect(typesSource).toMatch(/export interface FileMakerEditOptions\s*{[^}]*modId\?: string;/);
  });

  it('tells the developer in the generated README how to use it', () => {
    expect(readmeSource).toMatch(/modId/);
    expect(readmeSource).toMatch(/306/);
  });
});
