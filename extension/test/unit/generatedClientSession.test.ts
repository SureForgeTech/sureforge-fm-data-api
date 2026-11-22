import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { runInNewContext } from 'vm';
import * as ts from 'typescript6';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TypeGenService } from '../../src/services/typeGenService';

interface GeneratedClient {
  findContacts(request: unknown): Promise<unknown>;
  createSession(username: string, password: string): Promise<string>;
  deleteSession(): Promise<void>;
  validateSession(): Promise<void>;
}

interface Captured {
  url: string;
  method: string;
  body: unknown;
  headers: Record<string, string>;
}

function capturingFetch(
  response: unknown,
  seen: Captured[],
  status = 200
): typeof globalThis.fetch {
  return async (url, init) => {
    seen.push({
      url: String(url),
      method: init?.method ?? 'GET',
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      headers: (init?.headers ?? {}) as Record<string, string>
    });
    return new Response(JSON.stringify(response), { status });
  };
}

const OK = { code: '0', message: 'OK' };

function makeService() {
  const schema = {
    supported: true,
    fromCache: false,
    fields: [{ name: 'Name', type: 'normal', result: 'text' }],
    metadata: {}
  };
  return new TypeGenService(
    { getLayoutSchema: async () => schema } as never,
    {} as never,
    { debug() {}, info() {}, warn() {}, error() {} }
  );
}

describe('the generated client and its own session', () => {
  let root: string;
  let makeClient: (fetch: typeof globalThis.fetch, token?: string) => GeneratedClient;
  let clientSource: string;
  let readmeSource: string;
  let artifacts: { typesPath: string; clientPath: string; readmePath: string };

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), 'fm-client-session-'));
    const service = makeService();
    artifacts = await service.generateTypeScriptClient(
      { id: 'p', name: 'Test', database: 'DB' } as never,
      ['Contacts'],
      root
    );
    clientSource = await readFile(artifacts.clientPath, 'utf8');
    readmeSource = await readFile(artifacts.readmePath, 'utf8');
    const compiled = ts.transpileModule(clientSource, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
    });
    const exports: Record<string, new (config: unknown) => GeneratedClient> = {};
    // The vm sandbox has only ECMAScript built-ins; Node 18 and browsers provide these two.
    runInNewContext(compiled.outputText, { exports, TextEncoder, btoa });
    makeClient = (fetch, token = 'token') => new exports.FileMakerDataApiClient!({
      serverUrl: 'https://fm.example',
      database: 'DB',
      token,
      fetch
    });
  });
  afterAll(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('signs in with the Data API Basic sign-in and keeps the token', async () => {
    const seen: Captured[] = [];
    const client = makeClient(capturingFetch(
      { response: { token: 'fresh-token' }, messages: [OK] },
      seen
    ));

    const token = await client.createSession('tester', 'testpass1');

    const basic = Buffer.from('tester:testpass1', 'utf8').toString('base64');
    expect(token).toBe('fresh-token');
    expect(seen[0]!.method).toBe('POST');
    expect(seen[0]!.url).toBe('https://fm.example/fmi/data/vLatest/databases/DB/sessions');
    expect(seen[0]!.body).toEqual({});
    expect(seen[0]!.headers['Authorization']).toBe(`Basic ${basic}`);
  });

  it('signs the calls that follow with the new token', async () => {
    const seen: Captured[] = [];
    const responses: unknown[] = [
      { response: { token: 'fresh-token' }, messages: [OK] },
      { response: { data: [] }, messages: [OK] }
    ];
    const client = makeClient(async (url, init) => {
      seen.push({
        url: String(url),
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
        headers: (init?.headers ?? {}) as Record<string, string>
      });
      return new Response(JSON.stringify(responses.shift()), { status: 200 });
    }, '');

    await client.createSession('tester', 'testpass1');
    await client.findContacts({ query: [{ Name: 'Ada' }] });

    expect(seen[1]!.headers['Authorization']).toBe('Bearer fresh-token');
  });

  it('builds the Basic header from the UTF-8 name and password', async () => {
    const seen: Captured[] = [];
    const client = makeClient(capturingFetch(
      { response: { token: 't' }, messages: [OK] },
      seen
    ));

    await client.createSession('üser', 'päss');

    const basic = Buffer.from('üser:päss', 'utf8').toString('base64');
    expect(seen[0]!.headers['Authorization']).toBe(`Basic ${basic}`);
  });

  it('reports a refused sign-in as the error it is', async () => {
    const client = makeClient(capturingFetch(
      { response: {}, messages: [{ code: '212', message: 'Invalid username and password' }] },
      [],
      401
    ));

    await expect(client.createSession('tester', 'wrong')).rejects.toMatchObject({
      name: 'FileMakerDataApiError',
      code: '212'
    });
  });

  it('says so when the sign-in answers without a token', async () => {
    const client = makeClient(capturingFetch({ response: {}, messages: [OK] }, []));

    await expect(client.createSession('tester', 'testpass1')).rejects.toThrow(
      /did not include a session token/
    );
  });

  it('logs out with the token it holds', async () => {
    const seen: Captured[] = [];
    const client = makeClient(capturingFetch({ response: {}, messages: [OK] }, seen), 'a token');

    await client.deleteSession();

    expect(seen[0]!.method).toBe('DELETE');
    expect(seen[0]!.url).toBe(
      'https://fm.example/fmi/data/vLatest/databases/DB/sessions/a%20token'
    );
  });

  it('says so when asked to log out with no token', async () => {
    const seen: Captured[] = [];
    const client = makeClient(capturingFetch({ response: {}, messages: [OK] }, seen), '');

    await expect(client.deleteSession()).rejects.toThrow(/There is no session token to delete/);
    expect(seen).toHaveLength(0);
  });

  it('checks the token on the route that is not under a database', async () => {
    const seen: Captured[] = [];
    const client = makeClient(capturingFetch({ response: {}, messages: [OK] }, seen), 'a token');

    await client.validateSession();

    expect(seen[0]!.method).toBe('GET');
    expect(seen[0]!.url).toBe('https://fm.example/fmi/data/vLatest/validateSession');
    expect(seen[0]!.headers['Authorization']).toBe('Bearer a token');
  });

  it('reports a dead token when checked', async () => {
    const client = makeClient(capturingFetch(
      { response: {}, messages: [{ code: '952', message: 'Invalid data' }] },
      [],
      401
    ), 'a token');

    await expect(client.validateSession()).rejects.toMatchObject({
      name: 'FileMakerDataApiError',
      code: '952'
    });
  });

  it('tells the developer in the generated README how to sign in', () => {
    expect(readmeSource).toMatch(/createSession\(process\.env\.FM_USERNAME/);
    expect(readmeSource).toMatch(/deleteSession/);
    expect(readmeSource).toMatch(/validateSession/);
    expect(readmeSource).toMatch(/Claris ID \(FMID\) tenant is not covered/);
    // No literal credential reaches the README: the example takes the name and password from
    // the environment.
    expect(readmeSource).not.toMatch(/Basic [A-Za-z0-9+/]{4,}={0,2}['"`]/);
    expect(readmeSource).not.toMatch(/testpass/);
  });

  it('keeps the sign-in out of the generated code itself', () => {
    // The generated client builds the Basic header from the arguments it is given; no credential
    // is written into it.
    expect(clientSource).not.toMatch(/testpass/);
    expect(clientSource).not.toMatch(/Basic [A-Za-z0-9+/]{8,}={0,2}['"`]/);
  });

  it('the generated client compiles with the session calls', async () => {
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

async function run(): Promise<void> {
  const client = new FileMakerDataApiClient({
    serverUrl: 'https://fm.local',
    database: 'TestDB',
    token: '',
    fetch: fetchImpl
  });
  const token: string = await client.createSession('tester', 'testpass1');
  const records: ContactsRecord[] = await client.findContacts(request);
  await client.validateSession();
  await client.deleteSession();
  void token; void records;
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
