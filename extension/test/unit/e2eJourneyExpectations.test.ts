import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { FMClientError } from '../../src/services/errors';
import { explorerFailureText, fieldRowDescription } from '../../src/views/fmExplorer';
// @ts-expect-error The UI harness is JavaScript; no browser dependencies are loaded here.
import * as journeyFacts from '../../e2e-ui/lib/journeyFacts.mjs';

const { EXPLORER_FAILURE_LABEL, explorerFailureReason, isFieldRow, isScriptRunRequest } =
  journeyFacts;
const { WALKTHROUGH_STEPS } = journeyFacts;

const EXTENSION = path.join(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(EXTENSION, 'package.json'), 'utf8'));

/**
 * The desktop suite needs a packaged extension and a display, so it cannot run in a pull request.
 * These cases hold the journeys' expectations against the code, so a product change that moves
 * one of them fails here rather than on the machine that runs the suite.
 */
describe('the desktop journeys expect what the product does', () => {
  it('names every step of the walkthrough the manifest declares', () => {
    const declared = (manifest.contributes.walkthroughs ?? []).flatMap((walkthrough: { steps?: { title: string }[] }) =>
      (walkthrough.steps ?? []).map((step) => step.title)
    );
    expect(declared.length).toBeGreaterThan(0);
    expect(WALKTHROUGH_STEPS).toEqual(declared);
  });

  it('counts a field row the way the Explorer writes it', () => {
    // The Explorer writes the type, the kind when it is not the type's own name, and the
    // repetition count.
    const rows = [
      { name: 'FirstName', result: 'text', type: 'normal', repetitions: 1 },
      { name: 'FullName', result: 'text', type: 'calculation', repetitions: 1 },
      { name: 'TotalOrdered', result: 'number', type: 'summary', repetitions: 1 },
      { name: 'gFilter', result: 'text', type: 'normal', global: true, repetitions: 1 },
      { name: 'Avatar', result: 'container', type: 'normal', repetitions: 1 },
      { name: 'Phones', result: 'text', type: 'normal', repetitions: 3 }
    ];
    for (const field of rows) {
      const description = fieldRowDescription(field);
      expect(description.length).toBeGreaterThan(0);
      expect(isFieldRow(`${field.name} ${description}`), `${field.name}: ${description}`).toBe(true);
    }
    // A row that names no field type is not a field row.
    expect(isFieldRow('Customers Database')).toBe(false);
    expect(isFieldRow('Status Value list')).toBe(false);
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
  });
});
