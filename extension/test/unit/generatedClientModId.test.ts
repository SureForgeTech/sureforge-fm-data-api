import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { runInNewContext } from 'vm';
import * as ts from 'typescript6';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGenService } from '../../src/services/typeGenService';

interface GeneratedClient {
  editContacts(recordId: string, fieldData: unknown, options?: { modId?: string }): Promise<unknown>;
  createContacts(fieldData: unknown): Promise<unknown>;
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

  it('sends no version with a create', async () => {
    // A new record has no earlier version, and the Data API's create request body has no
    // modId field, so the create carries none.
    let body: unknown;
    const client = makeClient(async (_url, init) => {
      body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ response: { recordId: '1', modId: '0' }, messages: [{ code: '0', message: 'OK' }] }), { status: 200 });
    });

    await client.createContacts({ Name: 'Ada' });
    expect(body).toEqual({ fieldData: { Name: 'Ada' } });
    expect(Object.hasOwn(body as object, 'modId')).toBe(false);
  });

  it('gives the create no version option at all', () => {
    // The generated create must not even mention the version: a create has no earlier one.
    const start = clientSource.indexOf('public async createContacts');
    const end = clientSource.indexOf('public async editContacts');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(clientSource.slice(start, end)).not.toMatch(/modId/);
  });

  it('declares the option in the generated types', () => {
    expect(typesSource).toMatch(/export interface FileMakerEditOptions\s*{[^}]*modId\?: string;/);
  });

  it('tells the developer in the generated README how to use it', () => {
    expect(readmeSource).toMatch(/An edit can carry the record's `modId`/);
    expect(readmeSource).toMatch(/error 306/);
    expect(readmeSource).toMatch(/A create has no such option/);
  });
});
