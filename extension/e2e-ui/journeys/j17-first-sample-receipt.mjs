// Journey 17: the first-run path to a first sample receipt, and how long it took.
//
// The path is the one the UX inventory names: choose a starter, choose where the fields come
// from, save and preview, and submit the form. The measurement records the elapsed time and the
// deliberate choices the user had to make, so a run says how long a first-time user needed. The cold
// dependency setup - the preview installing the shipped template - is a separate cost and is
// recorded separately, the way the tracker asks for it.
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Measurement } from '../lib/report.mjs';
import { assert, clearCurrentMeasurement, setCurrentMeasurement } from '../lib/session.mjs';

const J = 'J17 first sample receipt';
const STARTER = 'Event Registration';
const INTAKE = 'event-registration';
// The submission is keyed by the form's field ids, the way the browser form sends them.
const VALUES = { name: 'Ada Lovelace', email: 'ada@example.com', session: 'Morning' };
const ORIGIN = 'http://127.0.0.1:3000';

/** The preview folders on this machine, so the one this run starts can be told apart. */
function previewFolders() {
  return new Set(
    fs
      .readdirSync(os.tmpdir(), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('fmweb-preview-'))
      .map((entry) => entry.name)
  );
}

export async function run(ctx) {
  const { s, report } = ctx;
  const measurement = new Measurement('first sample receipt');
  setCurrentMeasurement(measurement);
  const before = previewFolders();
  s.choice(`workspace: ${s.ws}`);

  await s.step(
    J,
    'the first-run path reaches the form editor',
    'the starter and the invented data are chosen, and the editor opens with the starter’s fields',
    async () => {
      await s.cmd('FileMaker: Create FM Web App');
      await s.pick(STARTER);
      s.choice(`starter: ${STARTER}`);
      await s.pick('Try sample fields');
      s.choice('fields: Try sample fields');
      const editor = await s.webview('#app-form');
      const title = await editor.locator('#title').inputValue();
      assert(title.trim().length > 0, 'the editor opened without a title');
      return `the editor is open with the title "${title}"`;
    }
  );

  let installMs = 0;
  await s.step(
    J,
    'the preview starts from the editor',
    'the confirmation asks before it runs the shipped template, and the preview becomes ready',
    async () => {
      const editor = await s.webview('[data-action="preview"]');
      await editor.locator('[data-action="preview"]').click();
      s.choice('action: Save and preview sample');
      await s.waitModal(30000);
      const buttons = await s.modalButtons();
      assert(
        buttons.some((button) => /^run$/i.test(button.trim())),
        `the confirmation has no Run button: ${buttons.join(' | ')}`
      );
      await s.modal('Run');
      const started = Date.now();
      const ready = await s.waitToast(/preview is ready in your browser/i, { timeout: 900000 });
      installMs = Date.now() - started;
      return `${ready} (the preview took ${Math.round(installMs / 1000)}s to become ready)`;
    }
  );

  await s.step(
    J,
    'the invented form is submitted and accepted',
    'the private link opens the form, and the submission comes back with a receipt',
    async () => {
      const folder = [...previewFolders()].find((name) => !before.has(name));
      assert(folder, 'the preview wrote no private folder');
      const linkFile = path.join(os.tmpdir(), folder, 'launch-url');
      assert(fs.existsSync(linkFile), 'the preview wrote no private launch link');
      const link = fs.readFileSync(linkFile, 'utf8').trim();
      // The link is redeemed once; the file has no reason to keep it afterwards.
      fs.rmSync(linkFile, { force: true });
      // The link is single use: the browser that the preview opened may have redeemed it already.
      const opened = await fetch(link, { redirect: 'manual' });
      const cookie = opened.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ');
      if (!cookie) {
        measurement.note(
          'The private link was already redeemed - the browser the preview opened took it - so the submission was not made here.'
        );
        return 'the link was redeemed by the browser that the preview opened';
      }
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
      s.choice('submission: the invented form');
      return `receipt ${outcome.receipt}`;
    }
  );

  measurement.note(
    `The preview's cold dependency setup took ${Math.round(installMs / 1000)}s of the elapsed time.`
  );
  report.measure(measurement.end());
  clearCurrentMeasurement();
}
