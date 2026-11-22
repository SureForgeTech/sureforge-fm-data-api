import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { runInNewContext } from 'vm';
import * as ts from 'typescript6';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGenService } from '../../src/services/typeGenService';

interface ScriptOutcome {
  scriptResult?: string;
  scriptError?: string;
  'scriptResult.prerequest'?: string;
  'scriptError.prerequest'?: string;
  'scriptResult.presort'?: string;
  'scriptError.presort'?: string;
}

interface GeneratedClient {
  findContacts(request: unknown, options?: Record<string, string>): Promise<unknown>;
  getContacts(recordId: string, options?: Record<string, string>): Promise<unknown>;
  createContacts(fieldData: unknown, options?: Record<string, string>): Promise<unknown>;
  editContacts(recordId: string, fieldData: unknown, options?: Record<string, string>): Promise<unknown>;
  deleteContacts(recordId: string): Promise<unknown>;
  runScriptContacts(script: string, scriptParam?: string): Promise<ScriptOutcome>;
}

interface Captured {
  url: string;
  method: string;
  body: unknown;
}

function capturingFetch(
  response: unknown,
  seen: Captured[]
): typeof globalThis.fetch {
  return async (url, init) => {
    seen.push({
      url: String(url),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : undefined
    });
    return new Response(JSON.stringify(response), { status: 200 });
  };
}

const OK = { code: '0', message: 'OK' };

describe('the generated client and FileMaker scripts', () => {
  let root: string;
  let makeClient: (fetch: typeof globalThis.fetch) => GeneratedClient;
  let clientSource: string;
  let typesSource: string;
  let readmeSource: string;
  let artifacts: { typesPath: string; clientPath: string; readmePath: string };

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'fm-client-scripts-'));
    const schema = {
      supported: true,
      fromCache: false,
      fields: [{ name: 'Name', type: 'normal', result: 'text' }],
      metadata: {}
    };
    const service = new TypeGenService(
      { getLayoutSchema: async () => schema } as never,
      {} as never,
      { debug() {}, info() {}, warn() {}, error() {} }
    );
    artifacts = await service.generateTypeScriptClient(
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

  it('runs a script on the dedicated route, with its parameter', async () => {
    const seen: Captured[] = [];
    const client = makeClient(capturingFetch(
      { response: { scriptResult: 'done', scriptError: '0' }, messages: [OK] },
      seen
    ));

    const outcome = await client.runScriptContacts('Tidy All', 'a value');

    expect(seen[0]!.method).toBe('GET');
    expect(seen[0]!.url).toBe(
      'https://fm.example/fmi/data/vLatest/databases/DB/layouts/Contacts/script/Tidy%20All?script.param=a%20value'
    );
    expect(outcome).toEqual({ scriptResult: 'done', scriptError: '0' });
  });

  it('runs a script with no parameter without a query', async () => {
    const seen: Captured[] = [];
    const client = makeClient(capturingFetch(
      { response: { scriptResult: '', scriptError: '0' }, messages: [OK] },
      seen
    ));

    await client.runScriptContacts('Refresh');

    expect(seen[0]!.url).toBe(
      'https://fm.example/fmi/data/vLatest/databases/DB/layouts/Contacts/script/Refresh'
    );
  });

  it('reports a script failure as the outcome, not as a failed request', async () => {
    // FileMaker error code 3 is the script's own answer; the call itself succeeded.
    const client = makeClient(capturingFetch(
      { response: { scriptResult: '', scriptError: '3' }, messages: [OK] },
      []
    ));

    const outcome = await client.runScriptContacts('Fail');

    expect(outcome).toEqual({ scriptResult: '', scriptError: '3' });
  });

  it('sends the script options with a find and returns the outcome with the records', async () => {
    const seen: Captured[] = [];
    const record = { recordId: '1', modId: '0', fieldData: { Name: 'Ada' } };
    const client = makeClient(capturingFetch(
      {
        response: {
          data: [record],
          scriptResult: 'r',
          scriptError: '0',
          'scriptResult.prerequest': 'pr',
          'scriptError.prerequest': '0',
          'scriptResult.presort': 'ps',
          'scriptError.presort': '0'
        },
        messages: [OK]
      },
      seen
    ));

    const result = await client.findContacts({ query: [{ Name: 'Ada' }] }, {
      script: 'Tidy',
      'script.param': 'a value',
      'script.prerequest': 'Pre',
      'script.prerequest.param': 'p',
      'script.presort': 'Sort',
      'script.presort.param': 's'
    });

    expect(seen[0]!.body).toEqual({
      query: [{ Name: 'Ada' }],
      script: 'Tidy',
      'script.param': 'a value',
      'script.prerequest': 'Pre',
      'script.prerequest.param': 'p',
      'script.presort': 'Sort',
      'script.presort.param': 's'
    });
    expect(result).toEqual({
      data: [record],
      scriptResult: 'r',
      scriptError: '0',
      'scriptResult.prerequest': 'pr',
      'scriptError.prerequest': '0',
      'scriptResult.presort': 'ps',
      'scriptError.presort': '0'
    });
  });

  it('sends no script keys with a find that has no options, and returns the list itself', async () => {
    const seen: Captured[] = [];
    const record = { recordId: '1', modId: '0', fieldData: { Name: 'Ada' } };
    const client = makeClient(capturingFetch(
      { response: { data: [record] }, messages: [OK] },
      seen
    ));

    const result = await client.findContacts({ query: [{ Name: 'Ada' }] });

    expect(seen[0]!.body).toEqual({ query: [{ Name: 'Ada' }] });
    expect(result).toEqual([record]);
  });

  it('sends the script options with a get as a percent-encoded query', async () => {
    const seen: Captured[] = [];
    const record = { recordId: '1', modId: '0', fieldData: { Name: 'Ada' } };
    const client = makeClient(capturingFetch(
      { response: { data: [record], scriptResult: 'r', scriptError: '0' }, messages: [OK] },
      seen
    ));

    const result = await client.getContacts('1', { script: 'Tidy', 'script.param': 'a b' });

    // A space is %20 in the query, never +: the Claris guide percent-encodes it exactly.
    expect(seen[0]!.url).toBe(
      'https://fm.example/fmi/data/vLatest/databases/DB/layouts/Contacts/records/1?script=Tidy&script.param=a%20b'
    );
    expect(result).toEqual({ record, scriptResult: 'r', scriptError: '0' });
  });

  it('returns the record itself when a get has no options', async () => {
    const seen: Captured[] = [];
    const record = { recordId: '1', modId: '0', fieldData: { Name: 'Ada' } };
    const client = makeClient(capturingFetch(
      { response: { data: [record] }, messages: [OK] },
      seen
    ));

    const result = await client.getContacts('1');

    expect(seen[0]!.url).toBe(
      'https://fm.example/fmi/data/vLatest/databases/DB/layouts/Contacts/records/1'
    );
    expect(result).toEqual(record);
  });

  it('carries the record version and the scripts together with an edit', async () => {
    const seen: Captured[] = [];
    const client = makeClient(capturingFetch(
      { response: { recordId: '1', modId: '8', scriptResult: 'r', scriptError: '0' }, messages: [OK] },
      seen
    ));

    const result = await client.editContacts('1', { Name: 'Ada' }, { modId: '7', script: 'Tidy' }) as ScriptOutcome;

    expect(seen[0]!.body).toEqual({ fieldData: { Name: 'Ada' }, modId: '7', script: 'Tidy' });
    expect(result.scriptResult).toBe('r');
  });

  it('carries scripts with a create, and still no record version', async () => {
    // A new record has no earlier version: the create carries no modId even with scripts.
    const seen: Captured[] = [];
    const client = makeClient(capturingFetch(
      { response: { recordId: '1', modId: '0' }, messages: [OK] },
      seen
    ));

    await client.createContacts({ Name: 'Ada' }, { script: 'Tidy' });

    expect(seen[0]!.body).toEqual({ fieldData: { Name: 'Ada' }, script: 'Tidy' });
    expect(Object.hasOwn(seen[0]!.body as object, 'modId')).toBe(false);
  });

  it('gives the delete no script option at all', () => {
    // The Data API has no script parameters on a delete.
    const start = clientSource.indexOf('public async deleteContacts');
    const end = clientSource.indexOf('public async runScriptContacts');
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(clientSource.slice(start, end)).not.toMatch(/script/i);
  });

  it('declares the script options and outcome in the generated types', () => {
    expect(typesSource).toMatch(
      /export interface FileMakerScriptOptions\s*{[^}]*'script\.param'\?: string;/
    );
    expect(typesSource).toMatch(
      /export interface FileMakerScriptOutcome\s*{[^}]*'scriptError\.prerequest'\?: string;/
    );
  });

  it('tells the developer in the generated README how to use it', () => {
    expect(readmeSource).toMatch(/runScript/);
    expect(readmeSource).toMatch(/`scriptError` is `"0"` when the script succeeded/);
    expect(readmeSource).toMatch(/A delete carries no scripts/);
  });

  it('the generated client compiles with the script calls', async () => {
    const usagePath = join(root, 'usage.ts');
    await writeFile(
      usagePath,
      `import { FileMakerDataApiClient } from './client';
import type { ContactsFindRequest, ContactsRecord } from './types';

const criteria: import('./types').ContactsFieldData = Object.create(null);
criteria.Name = 'Ada';
const request: ContactsFindRequest = { query: [criteria] };

const fetchImpl: typeof fetch = async () =>
  new Response(JSON.stringify({ response: { data: [] }, messages: [] }));

const client = new FileMakerDataApiClient({
  serverUrl: 'https://fm.local',
  database: 'TestDB',
  token: 'token',
  fetch: fetchImpl
});

async function run(): Promise<string | undefined> {
  const plain: ContactsRecord[] = await client.findContacts(request);
  const scripted = await client.findContacts(request, { script: 'Tidy', 'script.param': 'a' });
  const records: ContactsRecord[] = scripted.data;
  const findResult: string | undefined = scripted.scriptResult;
  const one: ContactsRecord = await client.getContacts('1');
  const oneScripted = await client.getContacts('1', { 'script.param': 'x' });
  const record: ContactsRecord = oneScripted.record;
  const getError: string | undefined = oneScripted['scriptError.prerequest'];
  const created = await client.createContacts({}, { script: 'Tidy' });
  const createdResult: string | undefined = created.scriptResult;
  const edited = await client.editContacts('1', {}, { modId: '7', script: 'Tidy' });
  const editedResult: string | undefined = edited.scriptError;
  await client.deleteContacts('1');
  const outcome = await client.runScriptContacts('Tidy', 'p');
  const outcomeResult: string | undefined = outcome.scriptResult;
  void plain; void records; void findResult; void one; void record; void getError;
  void createdResult; void editedResult; void outcomeResult;
  return one.fieldData.Name;
}

void run;
`,
      'utf8'
    );

    const program = ts.createProgram([artifacts.typesPath, artifacts.clientPath, usagePath], {
      noEmit: true,
      strict: true,
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      ignoreDeprecations: '6.0',
      lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'],
      types: [],
      skipLibCheck: true
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    expect(diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
  }, 30_000);
});
