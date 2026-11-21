// Step recorder: every step has an expectation, a result and a screenshot, and ends up in report.md/json.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Replace absolute local paths (home, temp, repository) so a committed or attached report names no machine. */
export function scrub(text) {
  let t = String(text ?? '');
  const roots = [
    [process.cwd(), '<cwd>'],
    [os.tmpdir(), '<tmp>'],
    [`/private${os.tmpdir()}`, '<tmp>'],
    [os.homedir(), '~']
  ];
  for (const [from, to] of roots) if (from && from.length > 3) t = t.split(from).join(to);
  return t
    .replace(/\/(?:private\/)?var\/folders\/[^/\s]+\/[^/\s]+\/T/g, '<tmp>')
    .replace(/\/Users\/[^/\s]+/g, '~')
    .replace(/\/home\/[^/\s]+/g, '~');
}

/**
 * One measured milestone: how long it took, and which choices the user had to make to reach it.
 * A journey starts one at the beginning of the path it measures, records a choice for every
 * decision the user faces, and ends it when the milestone is reached.
 */
export class Measurement {
  constructor(name, { startedAt = Date.now() } = {}) {
    this.name = String(name);
    this.startedAt = startedAt;
    this.choices = [];
    this.notes = [];
  }

  /** A decision the user had to make: the label they picked. */
  choice(label) {
    this.choices.push(String(label));
    return this;
  }

  /** Something the measurement itself has to say, such as what was not measured. */
  note(text) {
    this.notes.push(String(text));
    return this;
  }

  /** The measurement as it is recorded: the elapsed time, the choices and the notes. */
  end(now = Date.now()) {
    return {
      name: this.name,
      elapsedMs: Math.max(0, now - this.startedAt),
      choices: this.choices,
      notes: this.notes
    };
  }
}

export class Report {
  constructor(dir) {
    this.dir = dir;
    this.rows = [];
    this.measurements = [];
    this.n = 0;
    fs.mkdirSync(path.join(dir, 'screenshots'), { recursive: true });
  }

  /**
   * Record a measured milestone. The elapsed time and the deliberate choices are written to
   * measurements.json and to a section of report.md, so a run says how long a path took and what
   * the user had to decide on the way.
   */
  measure(measurement) {
    this.measurements.push(measurement);
    console.log(
      `[MEASURE] ${measurement.name}: ${Math.round(measurement.elapsedMs / 1000)}s, ${measurement.choices.length} choices`
    );
  }
  nextShot(journey, label) {
    this.n += 1;
    const safe = `${String(this.n).padStart(3, '0')}-${journey}-${label}`
      .replace(/[^\w.-]+/g, '_')
      .slice(0, 90);
    return path.join(this.dir, 'screenshots', `${safe}.png`);
  }
  add(row) {
    this.rows.push(row);
    const mark =
      { PASS: 'PASS', FAIL: 'FAIL', NOTE: 'NOTE', 'NOT-TESTABLE': 'N/T' }[row.result] ?? row.result;
    console.log(
      `[${mark}] ${row.journey} / ${row.step}${row.detail ? `  -- ${String(row.detail).split('\n')[0].slice(0, 160)}` : ''}`
    );
  }
  write() {
    const rows = this.rows.map((r) => ({
      ...r,
      shot: r.shot ? path.relative(this.dir, r.shot) : r.shot,
      detail: scrub(r.detail),
      expect: scrub(r.expect)
    }));
    fs.writeFileSync(path.join(this.dir, 'report.json'), JSON.stringify(rows, null, 2));
    fs.writeFileSync(path.join(this.dir, 'measurements.json'), JSON.stringify(this.measurements, null, 2));
    const esc = (s) =>
      String(s ?? '')
        .replace(/\|/g, '\\|')
        .replace(/\n/g, ' ')
        .slice(0, 400);
    const lines = ['# E2E UI report', '', `Generated ${new Date().toISOString()}`, ''];
    const counts = {};
    for (const r of this.rows) counts[r.result] = (counts[r.result] ?? 0) + 1;
    lines.push(
      `Totals: ${Object.entries(counts)
        .map(([k, v]) => `${k} ${v}`)
        .join(', ')}`,
      ''
    );
    lines.push(
      '| Journey | Step | Expectation | Result | Screenshot | Detail |',
      '|---|---|---|---|---|---|'
    );
    for (const r of this.rows)
      lines.push(
        `| ${esc(r.journey)} | ${esc(r.step)} | ${esc(scrub(r.expect))} | ${r.result} | ${r.shot ? path.relative(this.dir, r.shot) : ''} | ${esc(scrub(r.detail))} |`
      );
    if (this.measurements.length) {
      lines.push('', '## Measurements', '', '| Measurement | Elapsed | Choices | Notes |', '|---|---|---|---|');
      for (const m of this.measurements)
        lines.push(
          `| ${esc(m.name)} | ${Math.round((m.elapsedMs ?? 0) / 1000)} s | ${(m.choices ?? []).map((c) => esc(c)).join('; ')} | ${(m.notes ?? []).map((n) => esc(scrub(n))).join('; ')} |`
        );
    }
    fs.writeFileSync(path.join(this.dir, 'report.md'), `${lines.join('\n')}\n`);
  }
}
