import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error The UI harness is JavaScript; this test invokes only its choice recording.
import { Measurement, Report } from '../../e2e-ui/lib/report.mjs';
// @ts-expect-error The UI harness is JavaScript; this test invokes only its choice recording.
import { Session, clearCurrentMeasurement, getCurrentMeasurement, setCurrentMeasurement } from '../../e2e-ui/lib/session.mjs';

const roots: string[] = [];
afterEach(() => {
  clearCurrentMeasurement();
  roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true }));
});

/** A page with a command palette that lists these rows. */
function fakePage(rows: string[]) {
  const locator = {
    first: () => ({ waitFor: async () => {}, click: async () => {}, innerText: async () => rows[0] ?? '' }),
    allInnerTexts: async () => rows,
    count: async () => rows.length,
    nth: (index: number) => ({ click: async () => {}, innerText: async () => rows[index] ?? '' })
  };
  return {
    bringToFront: async () => {},
    keyboard: { type: async () => {}, press: async () => {} },
    locator: () => locator
  };
}

function session(rows: string[]) {
  const root = mkdtempSync(join(tmpdir(), 'e2e-choice-'));
  roots.push(root);
  const s = new Session({ report: new Report(root), vscode: {} as never, name: 'choice' });
  s.openPalette = async () => {};
  s.quickInputOpen = async () => {};
  s.page = fakePage(rows) as never;
  return s;
}

/** A page whose quick input box is a multi-select box, for `pickMany`. */
function fakeMultiSelectPage(rows: string[]) {
  const box = { fill: async () => {}, };
  const page = fakePage(rows);
  return {
    ...page,
    locator: (selector: string) =>
      selector === '.quick-input-box input' ? { first: () => box } : (page.locator as (value: string) => unknown)(selector)
  };
}

describe('the deliberate choices a run records', () => {
  it('records a command once it ran, under the label that ran', async () => {
    const measurement = new Measurement('a journey');
    setCurrentMeasurement(measurement);
    const s = session(['Recently used: FileMaker: Add Connection Profile']);
    await s.cmd('FileMaker: Add Connection Profile');
    expect(measurement.choices).toEqual(['command: FileMaker: Add Connection Profile']);
  });

  it('records nothing when the command did not run', async () => {
    const measurement = new Measurement('a journey');
    setCurrentMeasurement(measurement);
    const s = session(['FileMaker: Something Else']);
    await expect(s.cmd('FileMaker: Add Connection Profile')).rejects.toThrow(/command not found/);
    expect(measurement.choices).toEqual([]);
  });

  it('records the option that was picked, and nothing when the picker had none', async () => {
    const measurement = new Measurement('a journey');
    setCurrentMeasurement(measurement);
    const s = session(['Event Registration', 'Service Inquiry']);
    await s.pick('Event Registration');
    expect(measurement.choices).toEqual(['pick: Event Registration']);

    const other = new Measurement('another journey');
    setCurrentMeasurement(other);
    await expect(s.pick('Nothing Like It')).rejects.toThrow(/picker has no/);
    expect(other.choices).toEqual([]);
  });

  it('records a command the harness runs for itself as no choice', async () => {
    const measurement = new Measurement('a journey');
    setCurrentMeasurement(measurement);
    const s = session(['View: Close All Editors']);
    await s.cmd('View: Close All Editors', { record: false });
    expect(measurement.choices).toEqual([]);
  });

  it('records the choices of a second session in the same measurement', () => {
    const measurement = new Measurement('a journey');
    setCurrentMeasurement(measurement);
    session([]).choice('command: FileMaker: One');
    session([]).choice('command: FileMaker: Two');
    expect(measurement.choices).toEqual(['command: FileMaker: One', 'command: FileMaker: Two']);
    expect(getCurrentMeasurement()).toBe(measurement);
  });

  it('records nothing once the journey is over', () => {
    const measurement = new Measurement('a journey');
    setCurrentMeasurement(measurement);
    clearCurrentMeasurement();
    session([]).choice('command: FileMaker: One');
    expect(measurement.choices).toEqual([]);
  });

  it('records the row that ran when a command falls back to the highlighted row', async () => {
    const measurement = new Measurement('a journey');
    setCurrentMeasurement(measurement);
    // The palette does not list the command by name, so the fallback runs the highlighted row.
    const s = session(['FileMaker: Something Entirely Different']);
    await s.cmd('FileMaker: Add Connection Profile', { exact: false });
    expect(measurement.choices).toEqual(['command: FileMaker: Something Entirely Different']);
  });

  it('records nothing when the palette has no row to run', async () => {
    const measurement = new Measurement('a journey');
    setCurrentMeasurement(measurement);
    // No rows at all: the fallback runs nothing, so there is no choice to record.
    const s = session([]);
    await s.cmd('FileMaker: Add Connection Profile', { exact: false });
    expect(measurement.choices).toEqual([]);
  });

  it('records a multi-select as one decision', async () => {
    const measurement = new Measurement('a journey');
    setCurrentMeasurement(measurement);
    const s = session(['Contacts', 'Orders']);
    s.page = fakeMultiSelectPage(['Contacts', 'Orders']) as never;
    await s.pickMany(['Contacts', 'Orders']);
    expect(measurement.choices).toEqual(['pick: Contacts, Orders']);
  });
});
