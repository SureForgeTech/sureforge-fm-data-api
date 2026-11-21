// Journey 11: FM Web project, Layout Mode and the preview server: open, confirmations (declined), what works at this commit.
import fs from 'node:fs';
import path from 'node:path';

import { answerPickers, connect, createProfile, ensureProfileCommands } from '../lib/flows.mjs';
import { assert } from '../lib/session.mjs';

const J = 'J11 layout mode';
const walk = (dir) =>
  fs.existsSync(dir)
    ? fs
        .readdirSync(dir, { withFileTypes: true })
        .flatMap((e) =>
          e.isDirectory()
            ? e.name === 'node_modules'
              ? []
              : walk(path.join(dir, e.name))
            : [path.join(dir, e.name)]
        )
    : [];

export async function run(ctx) {
  const { s, mock } = ctx;
  if (!ctx.profileMain) {
    await createProfile(s, { name: 'Mock Quality', url: mock.baseUrl, database: 'Quality' });
    ctx.profileMain = true;
  }
  await ensureProfileCommands(s);
  if (!/Mock Quality/.test((await s.statusItem(/FileMaker:/)) ?? ''))
    await connect(s, 'Mock Quality');

  await s.step(
    J,
    'Initialize FM Web Project',
    'toast; .fmweb folder with a project file appears in the workspace',
    async () => {
      await s.cmd('FileMaker: Initialize FM Web Project');
      const t = await s.waitToast(/Initialized FM Web project|FM Web/i, { timeout: 20000 });
      const files = walk(path.join(s.ws, '.fmweb')).map((f) => path.relative(s.ws, f));
      assert(files.length > 0, 'no .fmweb files');
      return `${t} | ${files.slice(0, 6).join(', ')}`;
    }
  );
  await s.step(
    J,
    'after Initialize, the other FM Web commands are offered',
    'Sync and Open Layout Mode appear without reloading; Generate and Start Preview appear too, because the packaged build carries the runtime template (the harness turns the power-user setting on, which they need)',
    async () => {
      const ms = await s.waitCmdListed('FileMaker: Open FM Web Layout Mode', 10000);
      if (ms < 0) {
        await s.reloadWindow();
        const after = await s.waitCmdListed('FileMaker: Open FM Web Layout Mode', 8000);
        throw new Error(
          `not offered within 10 s of initialising the project; ${after >= 0 ? 'they appear only after a window reload' : 'not offered even after a reload'} (context key filemaker.fmWebProjectInitialized is refreshed only by Refresh Connections)`
        );
      }
      const sync = await s.cmdListed('FileMaker: Sync FM Web Project Metadata');
      const generate = await s.cmdListed('FileMaker: Generate FM Web Next.js App');
      const preview = await s.cmdListed('FileMaker: Start FM Web Preview Server');
      assert(sync, 'Sync FM Web Project Metadata is not offered after Initialize');
      assert(
        generate && preview,
        `the packaged build carries the runtime template, so the preview commands are offered (Generate=${generate}, Start Preview=${preview})`
      );
      return `Layout Mode listed after ${ms} ms; Sync listed; Generate and Start Preview listed`;
    }
  );
  await s.step(
    J,
    'Sync FM Web Project Metadata',
    'metadata for the active profile is written under .fmweb',
    async () => {
      await s.cmd('FileMaker: Sync FM Web Project Metadata');
      await answerPickers(s, ['Mock Quality']);
      await s.page.waitForTimeout(5000);
      const toasts = await s.toasts();
      const files = walk(path.join(s.ws, '.fmweb')).map((f) => path.relative(s.ws, f));
      return `toasts: ${toasts.join(' || ') || 'none'} | files: ${files.length}`;
    }
  );
  await s.step(
    J,
    'Open FM Web Layout Mode',
    'a designer panel opens (webview) for a layout',
    async () => {
      await s.closeAllEditors();
      await s.cmd('FileMaker: Open FM Web Layout Mode');
      await answerPickers(s, ['Mock Quality', 'Customers'], { max: 3 });
      await s.page.waitForTimeout(5000);
      const tabs = await s.editorTabs();
      const frame = s.page.frames().find((f) => /fake\.html/.test(f.url()));
      const body = frame
        ? (
            await frame
              .locator('body')
              .innerText()
              .catch(() => '')
          )
            .replace(/\s+/g, ' ')
            .slice(0, 300)
        : '';
      const toasts = await s.toasts();
      assert(
        tabs.some((t) => /Layout/i.test(t)),
        `tabs: ${tabs.join(', ')}; toasts: ${toasts.join(' | ')}`
      );
      return `tabs: ${tabs.join(', ')} | panel text: ${body || '(empty)'}`;
    }
  );
  await s.step(
    J,
    'Generate FM Web Next.js App from the packaged build',
    'the command is offered, because the packaged build carries the runtime template; nothing is generated until it is run',
    async () => {
      await s.closeAllEditors();
      const listed = await s.cmdListed('FileMaker: Generate FM Web Next.js App');
      const files = walk(path.join(s.ws, '.fmweb', 'generated')).map((f) => path.relative(s.ws, f));
      assert(listed, 'Generate FM Web Next.js App is not offered although the packaged build carries the runtime template');
      assert(files.length === 0, `unexpected generated files: ${files.join(', ')}`);
      return 'command offered; 0 generated files';
    }
  );
  await s.step(
    J,
    'Generate FM Web Next.js App writes the runtime template from the packaged build',
    'the command runs, and the template lands in the workspace',
    async () => {
      await s.closeAllEditors();
      await s.cmd('FileMaker: Generate FM Web Next.js App');
      let files = [];
      for (let i = 0; i < 60 && files.length === 0; i += 1) {
        await s.page.waitForTimeout(500);
        files = walk(path.join(s.ws, '.fmweb', 'generated'));
      }
      assert(files.length > 0, 'the runtime template was not generated from the packaged template');
      return `${files.length} generated files`;
    }
  );
  await s.step(
    J,
    'Start FM Web Preview Server from the packaged build',
    'the command is offered, because the packaged build carries the runtime template; no server starts until it is run',
    async () => {
      const listed = await s.cmdListed('FileMaker: Start FM Web Preview Server');
      const terminals = await s.page.locator('.terminal-tab, .terminal-tabs-entry').count();
      const nm = fs.existsSync(
        path.join(s.ws, '.fmweb', 'generated', 'runtime-next', 'node_modules')
      );
      assert(listed, 'Start FM Web Preview Server is not offered although the packaged build carries the runtime template');
      assert(
        !nm && terminals === 0,
        `a terminal or node_modules appeared (terminals ${terminals}, node_modules ${nm})`
      );
      return `command offered; terminals ${terminals}; node_modules ${nm}`;
    }
  );
  s.notTestable(
    J,
    'script-run confirmation from a layout file',
    'needs a layout definition with a script behaviour wired in the designer; the guard is covered by test/unit/layoutModeScriptGuard.test.ts, not driven through the UI here'
  );
  await s.step(
    J,
    'Start FM Web Preview Server asks before it runs the packaged template',
    'the command opens its confirmation, and declining it starts nothing',
    async () => {
      await s.cmd('FileMaker: Start FM Web Preview Server');
      await s.waitModal(20000);
      const buttons = await s.modalButtons();
      assert(
        buttons.some((button) => /cancel/i.test(button)),
        `no cancel button in the confirmation (buttons: ${buttons.join(' | ')})`
      );
      await s.modal('Cancel');
      await s.page.waitForTimeout(1500);
      // The install only starts after the confirmation, so no dependency folder means nothing started.
      const installed = fs.existsSync(
        path.join(s.ws, '.fmweb', 'generated', 'runtime-next', 'node_modules')
      );
      assert(!installed, 'the preview installed the template after the confirmation was declined');
      return 'declined; nothing installed';
    }
  );
  s.notTestable(
    J,
    'preview server actually started',
    'the packaged build carries the runtime template, but starting the preview installs that template\'s dependencies, which takes minutes and a network; this journey checks that the commands are offered and that declining the confirmation starts nothing'
  );
  await s.closeAllEditors();
}
