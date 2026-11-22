import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error The UI harness is JavaScript; this test invokes only its report writer.
import { Measurement, Report } from '../../e2e-ui/lib/report.mjs';

const roots: string[] = [];
afterEach(() => roots.splice(0).forEach((root) => rmSync(root, { recursive: true, force: true })));

function report() {
  const root = mkdtempSync(join(tmpdir(), 'e2e-measurement-'));
  roots.push(root);
  return new Report(root);
}

describe('the measured milestones of a run', () => {
  it('records the elapsed time and the choices that reached the milestone', () => {
    const r = report();
    const m = new Measurement('first sample receipt', { startedAt: Date.now() - 1500 });
    m.choice('starter: Event Registration');
    m.choice('fields: Try sample fields');
    m.note('The cold dependency setup is reported separately.');
    r.measure(m.end());
    r.write();

    const measurements = JSON.parse(readFileSync(join(r.dir, 'measurements.json'), 'utf8'));
    expect(measurements).toHaveLength(1);
    expect(measurements[0].name).toBe('first sample receipt');
    expect(measurements[0].elapsedMs).toBeGreaterThanOrEqual(1500);
    expect(measurements[0].choices).toEqual(['starter: Event Registration', 'fields: Try sample fields']);
    expect(measurements[0].notes).toHaveLength(1);

    const md = readFileSync(join(r.dir, 'report.md'), 'utf8');
    expect(md).toContain('## Measurements');
    expect(md).toContain('first sample receipt');
    expect(md).toContain('starter: Event Registration');
  });

  it('writes an empty measurement list, and no measurements section, when a run measured nothing', () => {
    const r = report();
    r.write();
    expect(readFileSync(join(r.dir, 'measurements.json'), 'utf8')).toBe('[]');
    expect(readFileSync(join(r.dir, 'report.md'), 'utf8')).not.toContain('## Measurements');
  });

  it('keeps literal table text in one Markdown cell and preserves the JSON text', () => {
    const r = report();
    const detail = 'A\\|B\r\n<C> & D';
    r.add({ journey: 'J', step: 'S', result: 'PASS', detail });
    r.write();

    const md = readFileSync(join(r.dir, 'report.md'), 'utf8');
    expect(md).toContain('| J | S |  | PASS |  | A&#92;&#124;B &lt;C&gt; &amp; D |');
    const rows = JSON.parse(readFileSync(join(r.dir, 'report.json'), 'utf8'));
    expect(rows[0].detail).toBe(detail);
  });

  it('records the elapsed time of a step in the report', () => {
    const r = report();
    r.add({ journey: 'J', step: 'a step', expect: 'what it checks', result: 'PASS', detail: '', ms: 1234 });
    r.write();

    const rows = JSON.parse(readFileSync(join(r.dir, 'report.json'), 'utf8'));
    expect(rows[0].ms).toBe(1234);
  });
});
