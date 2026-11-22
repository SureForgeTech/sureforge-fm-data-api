import { spawn, type ChildProcess } from 'child_process';
import { randomBytes } from 'crypto';
import { chmod, lstat, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import path from 'path';
import * as vscode from 'vscode';
import { serverOrigin } from '@fmweb/shared/dist/field-standards';

/** Do not inherit npm configuration, Node injection hooks or public Next env values. */
export function previewProcessEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of ['PATH', 'Path', 'HOME', 'USERPROFILE', 'SystemRoot', 'SYSTEMROOT', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR', 'COMSPEC', 'PATHEXT', 'LANG', 'LC_ALL', 'HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'no_proxy', 'NODE_EXTRA_CA_CERTS']) {
    if (source[key] !== undefined) env[key] = source[key];
  }
  env.NEXT_TELEMETRY_DISABLED = '1';
  return env;
}

export const PREVIEW_INSTALL_DESCRIPTION = 'npm install --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org --workspaces=false --include=optional';
/** Used instead when the shipped template carries a lockfile: exact versions, nothing resolved afresh. */
export const PREVIEW_LOCKED_INSTALL_DESCRIPTION = PREVIEW_INSTALL_DESCRIPTION.replace('npm install', 'npm ci');
/** The template's own server: the session cookie gate sits in front of Next's dev endpoints too. */
export const PREVIEW_SERVER_FILE = 'preview-server.mjs';
export const PREVIEW_DEV_DESCRIPTION = `node ${PREVIEW_SERVER_FILE} (Next.js development server on 127.0.0.1:3000)`;
const LOCK_FILE = 'package-lock.json';

/** `files` are bytes shipped with the extension, so a lockfile among them is trusted. */
export function previewInstallDescription(files: ReadonlyMap<string, Buffer>): string {
  return files.has(LOCK_FILE) ? PREVIEW_LOCKED_INSTALL_DESCRIPTION : PREVIEW_INSTALL_DESCRIPTION;
}

const OWNER_FILE = '.fmweb-preview-owner';
const OWNER_MARKER = 'filemaker-data-api-for-vs-code preview v1\n';
const activePreviews = new Set<FmWebPreviewProcess>();

export async function stopFmWebPreviews(): Promise<void> {
  await Promise.all([...activePreviews].map((preview) => preview.dispose()));
}

async function bounded<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error('Timed out stopping the private preview.')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

interface PreviewProcessOptions {
  platform: NodeJS.Platform;
  spawn: typeof spawn;
  kill: typeof process.kill;
  tempRoot: string;
  sourceEnv: NodeJS.ProcessEnv;
}

/** Each launch gets a fresh owner-only directory. No repository npm config, lock or dependency tree is executed. */
export class FmWebPreviewProcess implements vscode.Disposable {
  private child?: ChildProcess;
  private directory?: string;

  /** Where the private launch link was written, so a caller can offer it when no browser opened. */
  public get launchLinkPath(): string | undefined {
    return this.directory ? path.join(this.directory, 'launch-url') : undefined;
  }
  private cancelled = false;
  private starting?: Promise<void>;
  private stopping?: Promise<void>;
  private readonly options: PreviewProcessOptions;

  public constructor(options: Partial<PreviewProcessOptions> = {}) {
    this.options = { platform: process.platform, spawn, kill: process.kill, tempRoot: tmpdir(), sourceEnv: process.env, ...options };
  }

  public start(files: Map<string, Buffer>, layouts: Map<string, Buffer>, bridgeUrl: string, token: string, serverUrl?: string, intakes: Map<string, Buffer> = new Map(), intakeLayouts: Map<string, Buffer> = new Map(), startIntakeId?: string, registrationMode?: 'filemaker'): Promise<void> {
    activePreviews.add(this);
    this.starting = this.launch(files, layouts, bridgeUrl, token, serverUrl, intakes, intakeLayouts, startIntakeId, registrationMode);
    return this.starting;
  }

  /** Only remove old directories carrying our exact ownership marker; never follow links. */
  private async removeStaleDirectories(): Promise<void> {
    for (const name of await readdir(this.options.tempRoot)) {
      if (!name.startsWith('fmweb-preview-')) continue;
      const directory = path.join(this.options.tempRoot, name);
      if ([...activePreviews].some((preview) => preview.directory === directory)) continue;
      try {
        if (!(await lstat(directory)).isDirectory()) continue;
        const marker = path.join(directory, OWNER_FILE);
        const info = await lstat(marker);
        if (!info.isFile() || info.mtimeMs >= Date.now() - 86_400_000) continue;
        const owner = await readFile(marker, 'utf8');
        const pid = Number(owner.slice(OWNER_MARKER.length));
        if (!Number.isSafeInteger(pid) || pid <= 0 || owner !== `${OWNER_MARKER}${pid}\n`) continue;
        try { this.options.kill(pid, 0); continue; } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ESRCH') continue;
        }
        await bounded(rm(directory, { recursive: true, force: true }), 5000);
      } catch { /* Leave unrecognised or inaccessible directories alone. */ }
    }
  }

  private async npmCommand(env: NodeJS.ProcessEnv): Promise<{ command: string; prefix: string[]; node: string }> {
    if (this.options.platform !== 'win32') return { command: 'npm', prefix: [], node: 'node' };
    // Electron's executable directory does not contain npm. Resolve both tools from PATH,
    // then execute npm's JS entrypoint directly, without a command shell.
    const directories = (env.PATH ?? env.Path ?? '').split(';').filter((dir) => path.isAbsolute(dir));
    const find = async (suffix: string): Promise<string | undefined> => {
      for (const dir of directories) {
        const file = path.join(dir, suffix);
        if ((await stat(file).catch(() => undefined))?.isFile()) return file;
      }
      return undefined;
    };
    const node = await find('node.exe');
    const cli = await find(path.join('node_modules', 'npm', 'bin', 'npm-cli.js'));
    if (!node || !cli) throw new Error('Could not find Node.js and npm on PATH. Install Node.js with npm to start the preview.');
    return { command: node, prefix: [cli], node };
  }

  private async launch(files: Map<string, Buffer>, layouts: Map<string, Buffer>, bridgeUrl: string, token: string, serverUrl?: string, intakes: Map<string, Buffer> = new Map(), intakeLayouts: Map<string, Buffer> = new Map(), startIntakeId?: string, registrationMode?: 'filemaker'): Promise<void> {
    if (registrationMode === 'filemaker' && !startIntakeId) throw new Error('Real submissions require an explicit saved intake.');
    if (startIntakeId !== undefined) {
      const validId = /^[a-z]/.test(startIntakeId) && !/[^a-z0-9_-]/.test(startIntakeId) && startIntakeId.length <= 64;
      if (!validId || !intakes.has(`${startIntakeId}.intake.json`)) throw new Error('The requested preview intake is invalid or missing.');
    }
    await this.removeStaleDirectories();
    const directory = await mkdtemp(path.join(this.options.tempRoot, 'fmweb-preview-'));
    this.directory = directory;
    await chmod(directory, 0o700);
    await writeFile(path.join(directory, OWNER_FILE), `${OWNER_MARKER}${process.pid}\n`, { mode: 0o600, flag: 'wx' });
    const root = path.join(directory, 'runtime-next');
    await mkdir(root, { mode: 0o700 });
    for (const [name, bytes] of files) {
      const target = path.resolve(root, name);
      if (!target.startsWith(`${root}${path.sep}`)) throw new Error('Invalid template path.');
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes, { mode: 0o600, flag: 'wx' });
    }
    await mkdir(path.join(directory, 'layouts'));
    for (const [name, bytes] of layouts) {
      if (path.basename(name) !== name || !name.endsWith('.layout.json')) throw new Error('Invalid layout path.');
      await writeFile(path.join(directory, 'layouts', name), bytes, { flag: 'wx', mode: 0o600 });
    }
    if (intakes.size) {
      await mkdir(path.join(directory, 'intakes'), { mode: 0o700 });
      for (const [name, bytes] of intakes) {
        if (!/^[a-z][a-z0-9_-]{0,63}\.intake\.json$/.test(name) || bytes.length > 1048576) throw new Error('Invalid intake path or size.');
        await writeFile(path.join(directory, 'intakes', name), bytes, { flag: 'wx', mode: 0o600 });
      }
    }
    if (intakeLayouts.size) {
      await mkdir(path.join(directory, 'intake-layouts'), { mode: 0o700 });
      for (const [name, bytes] of intakeLayouts) {
        if (!/^[0-9a-f-]{36}\.layout\.json$/i.test(name) || bytes.length > 1048576) throw new Error('Invalid intake layout path or size.');
        await writeFile(path.join(directory, 'intake-layouts', name), bytes, { flag: 'wx', mode: 0o600 });
      }
    }
    const userconfig = path.join(directory, 'user.npmrc');
    const globalconfig = path.join(directory, 'global.npmrc');
    await writeFile(userconfig, '', { mode: 0o600, flag: 'wx' });
    await writeFile(globalconfig, '', { mode: 0o600, flag: 'wx' });
    const flags = [`--userconfig=${userconfig}`, `--globalconfig=${globalconfig}`, `--prefix=${root}`, `--cache=${path.join(directory, 'cache')}`];
    const env = previewProcessEnv(this.options.sourceEnv);
    const { command: npm, prefix, node } = await this.npmCommand(env);
    if (this.cancelled) throw new Error('Preview was cancelled.');
    // With a shipped lockfile `npm ci` installs exactly the recorded versions and fails rather
    // than resolve new ones. Without one (the first-run case today) fall back to `npm install`.
    await this.install(npm, [...prefix, ...flags, files.has(LOCK_FILE) ? 'ci' : 'install', '--ignore-scripts', '--no-audit', '--no-fund', '--registry=https://registry.npmjs.org', '--workspaces=false', '--include=optional'], root, env);
    if (this.cancelled) throw new Error('Preview was cancelled.');
    const launch = randomBytes(32).toString('hex');
    const launchUrl = `http://127.0.0.1:3000/?launch=${launch}`;
    // The launch code is a credential, so it is never logged. It is written to the preview's own
    // owner-only folder, so a run whose browser could not be opened - a CI runner, a remote
    // session - can still reach the preview, and so a test can drive the form.
    const linkFile = path.join(directory, 'launch-url');
    await writeFile(linkFile, `${launchUrl}\n`, { mode: 0o600, flag: 'wx' });
    // The launch code is redeemed once, and only within two minutes of the server start. The file
    // has no reason to outlive that window.
    const expiry = setTimeout(() => {
      void rm(linkFile, { force: true }).catch(() => undefined);
    }, 120_000);
    expiry.unref?.();
    const session = randomBytes(32).toString('hex');
    if (!files.has(PREVIEW_SERVER_FILE)) throw new Error('This installation does not carry the private preview server.');
    // Not `next dev`: its hot-reload and /_next, /__nextjs endpoints answer before the cookie gate.
    const child = this.options.spawn(node, [PREVIEW_SERVER_FILE], {
      cwd: root, shell: false, windowsHide: true, detached: this.options.platform !== 'win32',
      env: { ...env, NODE_ENV: 'development', FMWEB_BRIDGE_URL: bridgeUrl, FMWEB_BRIDGE_TOKEN: token, FMWEB_SERVER_ORIGIN: serverOrigin(serverUrl),
        FMWEB_LAUNCH_CODE: launch, FMWEB_PREVIEW_SESSION: session,
        ...(startIntakeId === undefined ? {} : { FMWEB_PREVIEW_INTAKE_ID: startIntakeId }),
        ...(registrationMode === 'filemaker' ? { FMWEB_REGISTRATION_MODE: 'filemaker' } : {}),
        FMWEB_LAUNCH_EXPIRES: String(Date.now() + 120_000), FMWEB_LAUNCH_STATE: path.join(directory, 'launch-used') },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    this.child = child;
    // Never echo server output: request logs could contain the one-time launch credential.
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Preview did not become ready in time.')), 90_000);
      let output = '';
      const ready = (chunk: Buffer) => {
        output = (output + chunk.toString()).slice(-4096);
        if (/Ready in|✓ Ready/.test(output)) { clearTimeout(timer); resolve(); }
      };
      child.stdout?.on('data', ready);
      child.stderr?.on('data', ready);
      child.once('error', () => { clearTimeout(timer); reject(new Error('Could not start Node.js. Check that Node.js and npm are installed.')); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Preview stopped before it was ready. Port 3000 must be free.')); });
    });
    if (this.cancelled) throw new Error('Preview was cancelled.');
    await vscode.env.openExternal(vscode.Uri.parse(launchUrl));
  }

  private install(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = this.options.spawn(command, args, { cwd, env, shell: false, windowsHide: true, detached: this.options.platform !== 'win32', stdio: 'ignore' });
      this.child = child;
      child.once('error', () => reject(new Error('Could not run npm install. Check that Node.js and npm are installed.')));
      child.once('exit', (code) => code === 0 ? resolve() : reject(new Error('Preview dependency installation failed. No install scripts were run.')));
    });
  }

  public dispose(): Promise<void> {
    this.cancelled = true;
    this.stopping ??= this.stop().catch((error) => {
      this.stopping = undefined;
      throw error;
    });
    return this.stopping;
  }

  private async stop(): Promise<void> {
    const child = this.child;
    try {
      if (child?.pid) {
        const exited = child.exitCode !== null || child.signalCode !== null
          ? Promise.resolve() : new Promise<void>((resolve) => child.once('exit', () => resolve()));
        if (this.options.platform === 'win32') {
          if (child.exitCode !== null || child.signalCode) return;
          // taskkill waits for the wrapper AND its descendants, including next dev.
          const killer = this.options.spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' });
          const code = await bounded(new Promise<number>((resolve, reject) => {
            killer.once('error', reject);
            killer.once('exit', (code) => code === 0 || code === 128 ? resolve(code) : reject(new Error('Could not stop the preview process tree.')));
          }), 5000);
          if (code === 0) await bounded(exited, 2000);
        } else {
          try { this.options.kill(-child.pid, 'SIGTERM'); } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
          }
          try { await bounded(exited, 2000); } catch { /* Escalate below. */ }
          // The npm wrapper can exit before its descendants; kill the remaining group too.
          try { this.options.kill(-child.pid, 'SIGKILL'); } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
          }
          await bounded(exited, 2000);
        }
      }
    } finally {
      this.child = undefined;
      try {
        // Cancellation during setup must finish before deletion, and must never start npm.
        await bounded(this.starting?.catch(() => undefined) ?? Promise.resolve(), 5000);
      } finally {
        try {
          if (this.directory) await bounded(rm(this.directory, { recursive: true, force: true }), 5000);
        } finally {
          // The folder is gone, so the path to the link in it is gone too.
          this.directory = undefined;
          activePreviews.delete(this);
        }
      }
    }
  }
}
