// Journey 17: the first-run path to a first sample receipt, and how long it took.
//
// The path is the one the UX inventory names: choose a starter, choose where the fields come
// from, save and preview, and submit the form. The measurement records the elapsed time and the
// choices the user had to make, so a run says how long a first-time user needed and what they had
// to decide. The cold dependency setup - the generated app's npm install - is a separate cost, and
// the measurement says so.
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Measurement } from '../lib/report.mjs';
import { assert, clearCurrentMeasurement, setCurrentMeasurement } from '../lib/session.mjs';

const J = 'J17 first sample receipt';
const STARTER = 'Event Registration';
const INTAKE = 'event-registration';
const VALUES = { ' Full Name ': 'Ada Lovelace', 'Email Address': 'ada@example.com', Session: 'Morning' };
const ORIGIN = 'http://127.0.0.1:3000';

/** The private launch link the preview wrote into its own folder. */
function launchLink() {
  for (const name of fs.readdirSync(os.tmpdir())) {
    if (!name.startsWith('fmweb-preview-')) continue;
    const file = path.join(os.tmpdir(), name, 'launch-url');
    if (!fs.existsSync(file)) continue;
    const link = fs.readFileSync(file, 'utf8').trim();
    if (link) return link;
  }
  return undefined;
}

export async function run(ctx) {
  const { s, report } = ctx;
  const measurement = new Measurement('first sample receipt');
  setCurrentMeasurement(measurement);
  s.choice(`workspace: ${s.ws}`);

  await s.step(
    J,
    'the first-run path reaches the form editor',
    'the starter and the invented data are chosen, and the editor opens',
    async () => {
      await s.cmd('FileMaker: Create FM Web App');
      await s.pick(STARTER);
      s.choice(`starter: ${STARTER}`);
      await s.pick('Try sample fields');
      s.choice('fields: Try sample fields');
      await s.webview('#app-form');
      return 'the editor is open with the starter and its invented fields';
    }
  );

  await s.step(
    J,
    'the preview starts from the editor',
    'the confirmation asks before it runs the shipped template, and the preview becomes ready',
    async () => {
      const editor = await s.webview('[data-action="preview"]');
      await editor.click();
      await s.waitModal(30000);
      const buttons = await s.modalButtons();
      assert(
        buttons.some((button) => /^run$/i.test(button.trim())),
        `the confirmation has no Run button: ${buttons.join(' | ')}`
      );
      await s.modal('Run');
      const ready = await s.waitToast(/preview is ready in your browser/i, { timeout: 600000 });
      return ready;
    }
  );

  await s.step(
    J,
    'the invented form is submitted and accepted',
    'the private link opens the form, and the submission comes back with a receipt',
    async () => {
      const link = launchLink();
      assert(link, 'the preview wrote no private launch link');
      const opened = await fetch(link, { redirect: 'manual' });
      const cookie = opened.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ');
      assert(cookie, 'the private link set no session cookie');
      const response = await fetch(`${ORIGIN}/api/intake/${INTAKE}`, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'Content-Type': 'application/json', origin: ORIGIN, cookie },
        body: JSON.stringify({ submissionId: randomUUID(), values: VALUES })
      });
      const outcome = await response.json();
      assert(response.ok, `the submission was refused: ${JSON.stringify(outcome)}`);
      assert(outcome.status === 'accepted', `the submission was not accepted: ${JSON.stringify(outcome)}`);
      assert(outcome.receipt, 'the receipt was empty');
      return `receipt ${outcome.receipt}`;
    }
  );

  measurement.note(
    'The elapsed time includes the preview installing the shipped template; the cold dependency setup is part of that.'
  );
  report.measure(measurement.end());
  clearCurrentMeasurement();
}
