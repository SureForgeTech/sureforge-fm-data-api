import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { FMClientError } from '../../src/services/errors';
import { SCRIPTS_PATH } from '../../src/services/fmClient/metadata';
import { extractFieldsFromMetadata } from '../../src/services/schemaService';
// @ts-expect-error The mock server is JavaScript; it is loaded here as the server the journeys run against.
import { createEngine } from '../../test/mock-server/lib/engine.mjs';
import {
  EXPLORER_FAILURE_LABELS,
  explorerFailureText,
  fieldRowDescription
} from '../../src/views/fmExplorer';
// @ts-expect-error The UI harness is JavaScript; no browser dependencies are loaded here.
import * as journeyFacts from '../../e2e-ui/lib/journeyFacts.mjs';

const {
  EXPLORER_FAILURE_LABEL,
  EXPLORER_FAILURE_REASON,
  explorerFailureReason,
  isFieldRow,
  isScriptRunRequest,
  SCRIPT_LIST_REQUEST
} = journeyFacts;
const { WALKTHROUGH_STEPS } = journeyFacts;

const EXTENSION = path.join(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(EXTENSION, 'package.json'), 'utf8'));

/**
 * The desktop suite needs a packaged extension and a display, so it cannot run in a pull request.
 * These cases hold the journeys' expectations against the code, so a product change that moves
 * one of them fails here rather than on the machine that runs the suite.
 */
/**
 * The fields the mock's Customers layout carries, as the server reports them. The journeys run
 * against that mock, so the field types they meet are the ones this returns.
 */
async function mockLayoutFields(): Promise<Array<{ name: string; result?: string; type?: string; global?: boolean; repetitions?: number }>> {
  const engine = createEngine();
  const request = async (method: string, pathname: string, body: string, authorization: string) =>
    engine.dispatch({
      method,
      pathname,
      query: new URLSearchParams(),
      headers: { host: 'localhost', 'content-type': 'application/json', authorization },
      body: Buffer.from(body)
    });
  const session = await request(
    'POST',
    '/fmi/data/vLatest/databases/Quality/sessions',
    '{}',
    'Basic ' + Buffer.from('tester:testpass1').toString('base64')
  );
  assert(session.status === 200, `the mock refused the sign-in: ${session.status}`);
  const token = (session.json as { response?: { token?: string } }).response?.token;
  assert(token, 'the mock issued no session token');
  const metadata = await request(
    'GET',
    '/fmi/data/vLatest/databases/Quality/layouts/Customers',
    '',
    'Bearer ' + token
  );
  assert(metadata.status === 200, `the mock refused the layout metadata: ${metadata.status}`);
  const fields = (metadata.json as { response?: { fieldMetaData?: unknown } }).response?.fieldMetaData;
  assert(Array.isArray(fields) && fields.length > 0, 'the mock returned no field metadata');
  // The fields the Explorer renders come from the product's own extraction of what the mock
  // returns, so the row held here is the row the Explorer writes.
  const extracted = extractFieldsFromMetadata((metadata.json as { response?: Record<string, unknown> }).response ?? {});
  assert(extracted.length === fields.length, 'the product extracted a different number of fields');
  return extracted;
}

describe('the desktop journeys expect what the product does', () => {
  it('names every step of the walkthrough the manifest declares', () => {
    const declared = (manifest.contributes.walkthroughs ?? []).flatMap((walkthrough: { steps?: { title: string }[] }) =>
      (walkthrough.steps ?? []).map((step) => step.title)
    );
    expect(declared.length).toBeGreaterThan(0);
    expect(WALKTHROUGH_STEPS).toEqual(declared);
  });

  it('counts a field row the way the Explorer writes it', async () => {
    // The Explorer writes the type, the kind when it is not the type's own name, and the
    // repetition count. The fields are the ones the mock's own layout carries, so a field type the
    // mock adds fails here rather than quietly dropping rows from the journey's count.
    const rows = await mockLayoutFields();
    expect(rows.length).toBeGreaterThan(0);
    for (const field of rows) {
      const description = fieldRowDescription(field);
      expect(description).toBeTruthy();
      expect(isFieldRow(`${field.name} ${description}`), `${field.name}: ${description}`).toBe(true);
    }
    // A field with nothing to say has no description at all.
    expect(fieldRowDescription({ name: 'Empty' })).toBeUndefined();
    // A row that names no field type is not a field row.
    expect(isFieldRow('Customers Database')).toBe(false);
    expect(isFieldRow('Status Value list')).toBe(false);
  });

  it('names the Explorer failure row the Explorer names', () => {
    // The journeys look for the row by this label, so it has to be the one the tree writes.
    expect(EXPLORER_FAILURE_LABEL).toBe(EXPLORER_FAILURE_LABELS.layouts);
    expect(EXPLORER_FAILURE_LABELS.fields).not.toBe(EXPLORER_FAILURE_LABELS.layouts);
    expect(EXPLORER_FAILURE_LABELS.valueLists).not.toBe(EXPLORER_FAILURE_LABELS.layouts);
  });

  it('reads the reason an Explorer failure row carries, with the cause in its tooltip', () => {
    // The failure the journeys drive: the server answers a data call with a web page.
    const error = new FMClientError(
      'The server did not return Data API JSON (layouts; HTTP 200, text/html). ' +
        'A web page, proxy, firewall or sign-in page may be answering instead of FileMaker Server.',
      { status: 200, code: 'NOT_DATA_API_RESPONSE', kind: 'server' }
    );
    const failure = explorerFailureText(error, 'Use FileMaker: Connect, then refresh explorer.');
    // The row names what went wrong; it is never the generic advice on its own.
    expect(failure.description.length).toBeGreaterThan(0);
    expect(failure.description).not.toMatch(/use filemaker: connect, then refresh explorer/i);
    // The full cause is in the tooltip.
    expect(failure.tooltip).toMatch(/web page/i);
    expect(failure.tooltip).toMatch(/output channel/i);

    // The reason has to name the failure, or the journey's fallback could not tell a failure
    // from the generic advice.
    expect(failure.description).toMatch(EXPLORER_FAILURE_REASON);
    // A failure with no status to quote still has to name what went wrong.
    const offline = explorerFailureText(
      new FMClientError('connect ECONNREFUSED 127.0.0.1:443', { kind: 'network' }),
      'Use FileMaker: Connect, then refresh explorer.'
    );
    expect(offline.description).toMatch(EXPLORER_FAILURE_REASON);

    const row = `${EXPLORER_FAILURE_LABEL} ${failure.description}`;
    expect(explorerFailureReason(row)).toBe(failure.description);
  });

  it('leaves the script list request out of what a script run sent', () => {
    // The panel asks the server for the script list when it opens, and the client signs in
    // before the run.
    expect(isScriptRunRequest('GET /databases/Quality/scripts -> 200/0')).toBe(false);
    expect(isScriptRunRequest('POST /databases/Quality/sessions -> 200/0')).toBe(false);
    expect(
      isScriptRunRequest('GET /layouts/Customers/script/Echo?script.param=only -> 200/0')
    ).toBe(true);
    // A record read and a find are what the check exists to catch, so they have to survive it.
    expect(isScriptRunRequest('GET /layouts/Customers/records/1 -> 200/0')).toBe(true);
    expect(isScriptRunRequest('POST /layouts/Customers/_find -> 200/0')).toBe(true);
  });

  it('recognises the script list request the product sends', () => {
    // The journey leaves the script list out of the requests a script run made. The path comes
    // from the product, so a rename here breaks this case rather than the journey.
    expect(SCRIPT_LIST_REQUEST.test(SCRIPTS_PATH)).toBe(true);
    expect(SCRIPT_LIST_REQUEST.test('/sessions')).toBe(false);
    expect(isScriptRunRequest('GET /sessions')).toBe(false);
    expect(isScriptRunRequest(`GET ${SCRIPTS_PATH}`)).toBe(false);
  });
});
