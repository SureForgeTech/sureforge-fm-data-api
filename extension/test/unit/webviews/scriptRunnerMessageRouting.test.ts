import * as vscode from 'vscode';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FMClientError } from '../../../src/services/errors';
import { generateSnippet } from '../../../src/snippets';
import { ScriptRunnerPanel } from '../../../src/webviews/scriptRunner';
import { InMemoryMemento } from '../mocks';
import { directProfile } from '../snippets/fixtures';

/**
 * Which message of the Script Runner reaches which handler, what the panel answers, and what it
 * refuses. The panel is not changed here: every expectation reads what the code does today.
 */

type Handler = (message: unknown) => void;

const profile = { ...directProfile, id: 'p1' };
const script = { profileId: 'p1', layout: 'Contacts', scriptName: 'Send Welcome' };

function open() {
  let handler: Handler | undefined;
  let onDispose: (() => void) | undefined;
  const posted: Array<Record<string, unknown>> = [];

  vi.mocked(vscode.window.createWebviewPanel).mockReturnValue({
    webview: {
      html: '',
      cspSource: 'vscode-resource:',
      asWebviewUri: (uri: unknown) => uri,
      postMessage: vi.fn(async (message: Record<string, unknown>) => {
        posted.push(message);
        return true;
      }),
      onDidReceiveMessage: (callback: Handler) => {
        handler = callback;
        return { dispose: vi.fn() };
      }
    },
    reveal: vi.fn(),
    onDidDispose: (callback: () => void) => {
      onDispose = callback;
      return { dispose: vi.fn() };
    }
  } as never);

  const fmClient = {
    listLayouts: vi.fn(async () => ['Contacts']),
    listScripts: vi.fn(async () => ['Send Welcome']),
    runScript: vi.fn(async () => ({ response: { scriptResult: 'done' }, messages: [{ code: '0', message: 'OK' }] }))
  };
  const profileStore = {
    listProfiles: vi.fn(async () => [profile]),
    getProfile: vi.fn(async (id: string) => (id === profile.id ? profile : undefined)),
    getActiveProfileId: vi.fn(() => profile.id)
  };
  const logger = { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() };

  (ScriptRunnerPanel as unknown as { currentPanel: unknown }).currentPanel = undefined;
  ScriptRunnerPanel.createOrShow(
    { extensionUri: { fsPath: '/ext' }, workspaceState: new InMemoryMemento() } as never,
    profileStore as never,
    fmClient as never,
    logger as never
  );

  const send = async (message: unknown): Promise<void> => {
    const runner = (ScriptRunnerPanel as unknown as { currentPanel: { requestInFlight: boolean } }).currentPanel;
    handler?.(message);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await vi.waitFor(() => expect(runner.requestInFlight).toBe(false));
  };

  const copied = (): string => String(vi.mocked(vscode.env.clipboard.writeText).mock.calls.at(-1)?.[0]);

  return { send, posted, fmClient, profileStore, logger, copied, close: () => onDispose?.() };
}

describe('Script Runner: message routing', () => {
  let panel: ReturnType<typeof open>;

  beforeEach(() => {
    vi.clearAllMocks();
    // The panel reads the feature switch and offline mode from the settings; every test starts
    // from the defaults, so a test that changes them does not change the next one.
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
      get: (_key: string, fallback?: unknown) => fallback
    } as never);
    (vscode.workspace as unknown as { isTrusted: boolean }).isTrusted = true;
    panel = open();
  });

  afterEach(() => {
    panel.close();
  });

  it('logs only the script name, exact layout and error code on failure', async () => {
    panel.fmClient.runScript.mockRejectedValue(new FMClientError('private server detail', {
      code: '102', details: { response: 'private response' }
    }));
    await panel.send({ type: 'runScript', payload: { ...script, scriptParam: 'private parameter' } });
    expect(panel.logger.warn).toHaveBeenCalledWith('Script runner failed.', {
      scriptName: script.scriptName, layout: script.layout, code: '102'
    });
    expect(JSON.stringify(panel.logger.warn.mock.calls)).not.toContain('private');
  });

  describe('every message reaches its handler', () => {
    it('answers "ready" with the init message', async () => {
      await panel.send({ type: 'ready' });
      expect(panel.posted).toContainEqual(
        expect.objectContaining({
          type: 'init',
          payload: expect.objectContaining({
            profiles: [expect.objectContaining({ id: 'p1', name: 'Production', database: 'Sales DB', authMode: 'direct' })],
            activeProfileId: 'p1',
            scriptRunnerEnabled: true,
            includeAuthByDefault: false,
            parameterBuilderEnabled: true
          })
        })
      );
      expect(panel.fmClient.runScript).not.toHaveBeenCalled();
    });

    it('does not claim a script is running when the run never reached the server', async () => {
      panel.fmClient.runScript.mockRejectedValue(new FMClientError(
        'Request timed out waiting for the connection to sign in after 0.1 s. The sign-in may still be running; try again.',
        { kind: 'timeout', code: 'SESSION_WAIT_TIMEOUT' }
      ));
      await panel.send({ type: 'runScript', payload: script });
      const message = String(panel.posted.find((entry) => entry.type === 'error')?.message);
      expect(message).not.toContain('script may still be running');
      expect(message).not.toContain('Timeout field');
    });

    it('does not claim a script is running when the layout list times out', async () => {
      panel.fmClient.listLayouts.mockRejectedValue(new FMClientError('Request timed out after 15.0 s.', {
        kind: 'timeout'
      }));
      await panel.send({ type: 'loadLayouts', profileId: 'p1' });
      const message = panel.posted.find((entry) => entry.type === 'error')?.message;
      expect(String(message)).not.toContain('script may still be running');
      expect(String(message)).not.toContain('Timeout field');
    });

    it('answers "loadLayouts" with the layouts of that profile', async () => {
      await panel.send({ type: 'loadLayouts', profileId: 'p1' });
      expect(panel.fmClient.listLayouts).toHaveBeenCalledWith(profile);
      expect(panel.posted).toContainEqual({ type: 'layoutsLoaded', payload: { profileId: 'p1', layouts: ['Contacts'] } });
    });

    it('answers "loadScripts" with the scripts of that profile', async () => {
      await panel.send({ type: 'loadScripts', profileId: 'p1' });

      expect(panel.fmClient.listScripts).toHaveBeenCalledWith(profile);
      expect(panel.posted).toContainEqual({
        type: 'scriptsLoaded',
        payload: { profileId: 'p1', scripts: ['Send Welcome'] }
      });
    });

    it('answers "runScript" with the result of the script', async () => {
      await panel.send({ type: 'runScript', payload: script });
      expect(panel.fmClient.runScript).toHaveBeenCalledWith(profile, expect.objectContaining({ layout: 'Contacts', scriptName: 'Send Welcome' }), { signal: expect.any(AbortSignal) });
      expect(panel.posted).toContainEqual(
        expect.objectContaining({ type: 'scriptResult', payload: expect.objectContaining({ profileId: 'p1' }) })
      );
    });

    it('asks for the deadline the user typed, and keeps the shared timeout when the field is empty', async () => {
      await panel.send({ type: 'runScript', payload: { ...script, timeoutSeconds: 120 } });
      expect(panel.fmClient.runScript).toHaveBeenCalledWith(
        profile,
        expect.objectContaining({ layout: 'Contacts', scriptName: 'Send Welcome' }),
        { timeoutMs: 120_000, signal: expect.any(AbortSignal) }
      );

      await panel.send({ type: 'runScript', payload: script });
      expect(panel.fmClient.runScript).toHaveBeenLastCalledWith(
        profile,
        expect.objectContaining({ layout: 'Contacts', scriptName: 'Send Welcome' }),
        { signal: expect.any(AbortSignal) }
      );
    });

    it('does not dispatch a run when the panel closes during profile lookup', async () => {
      let finishLookup!: (value: typeof profile) => void;
      panel.profileStore.getProfile.mockImplementationOnce(() => new Promise((resolve) => { finishLookup = resolve; }));
      const pending = panel.send({ type: 'runScript', payload: script });
      await vi.waitFor(() => expect(finishLookup).toBeTypeOf('function'));
      panel.close();
      finishLookup(profile);
      await pending;
      expect(panel.fmClient.runScript).not.toHaveBeenCalled();
      expect(panel.posted).toEqual([]);
    });

    it.each(['success', 'failure', 'unsupported'] as const)('aborts a dispatched run and posts nothing after disposal (%s)', async (outcome) => {
      let finishRun!: () => void;
      panel.fmClient.runScript.mockImplementationOnce(() => new Promise((resolve, reject) => {
        finishRun = () => {
          if (outcome === 'success') resolve({ response: { scriptResult: 'done' }, messages: [] });
          else reject(new FMClientError('Run failed.', { code: outcome === 'unsupported' ? 'SCRIPT_UNSUPPORTED' : undefined }));
        };
      }));
      const pending = panel.send({ type: 'runScript', payload: script });
      await vi.waitFor(() => expect(panel.fmClient.runScript).toHaveBeenCalledOnce());
      const signal = (panel.fmClient.runScript.mock.calls[0] as unknown as [unknown, unknown, { signal: AbortSignal }])[2].signal;
      expect(signal.aborted).toBe(false);
      panel.close();
      expect(signal.aborted).toBe(true);
      finishRun();
      await pending;
      expect(panel.posted).toEqual([]);
    });

    it('names the Timeout field when a run gives up waiting', async () => {
      panel.fmClient.runScript.mockRejectedValue(new FMClientError('Request timed out after 0.1 s.', {
        kind: 'timeout'
      }));
      await panel.send({ type: 'runScript', payload: script });
      expect(panel.posted).toContainEqual(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('Raise the Timeout field in this panel')
        })
      );
      expect(panel.posted).toContainEqual(
        expect.objectContaining({
          type: 'error',
          message: expect.stringContaining('The script may still be running on the server.')
        })
      );
    });

    it('refuses a timeout outside the bounds, and runs no script', async () => {
      await panel.send({ type: 'runScript', payload: { ...script, timeoutSeconds: 5000 } });
      expect(panel.fmClient.runScript).not.toHaveBeenCalled();
      expect(panel.posted).toContainEqual(
        expect.objectContaining({ type: 'error', message: expect.stringContaining('timeout must be a whole number') })
      );
    });

    it('answers "copyCurl" with a curl command on the clipboard, and runs no script', async () => {
      await panel.send({ type: 'copyCurl', payload: script });
      expect(vi.mocked(vscode.env.clipboard.writeText)).toHaveBeenCalledTimes(1);
      expect(panel.copied()).toContain('curl -X GET ');
      expect(panel.fmClient.runScript).not.toHaveBeenCalled();
    });

    it('answers "copyFetch" with a fetch snippet on the clipboard, and runs no script', async () => {
      await panel.send({ type: 'copyFetch', payload: script });
      expect(vi.mocked(vscode.env.clipboard.writeText)).toHaveBeenCalledTimes(1);
      expect(panel.copied()).toContain('await fetch(');
      expect(panel.fmClient.runScript).not.toHaveBeenCalled();
    });

    it('answers "copyRequest" with the format the message asks for, and runs no script', async () => {
      await panel.send({ type: 'copyRequest', payload: { ...script, format: 'http' } });
      expect(vi.mocked(vscode.env.clipboard.writeText)).toHaveBeenCalledWith(
        generateSnippet(profile, { kind: 'runScript', layout: 'Contacts', scriptName: 'Send Welcome' }, 'http')
      );
      expect(panel.fmClient.runScript).not.toHaveBeenCalled();
    });
  });

  describe('a message the panel cannot use is ignored', () => {
    it('ignores a message of an unknown type', async () => {
      await panel.send({ type: 'somethingElse', payload: script });
      expect(panel.posted).toEqual([]);
      expect(panel.fmClient.listLayouts).not.toHaveBeenCalled();
      expect(panel.fmClient.runScript).not.toHaveBeenCalled();
      expect(vi.mocked(vscode.env.clipboard.writeText)).not.toHaveBeenCalled();
    });

    it('ignores a message that is not an object', async () => {
      for (const message of [null, 'ready', 42]) {
        await panel.send(message);
      }
      expect(panel.posted).toEqual([]);
      expect(panel.fmClient.runScript).not.toHaveBeenCalled();
    });

    it('ignores "loadScripts" without a profile id', async () => {
      await panel.send({ type: 'loadScripts' });

      expect(panel.fmClient.listScripts).not.toHaveBeenCalled();
      expect(panel.posted).toEqual([]);
    });

    it('ignores "loadLayouts" without a profile id', async () => {
      await panel.send({ type: 'loadLayouts' });
      await panel.send({ type: 'loadLayouts', profileId: 42 });
      expect(panel.posted).toEqual([]);
      expect(panel.fmClient.listLayouts).not.toHaveBeenCalled();
    });

    it('ignores "runScript" without a script name', async () => {
      await panel.send({ type: 'runScript', payload: { profileId: 'p1', layout: 'Contacts' } });
      expect(panel.posted).toEqual([]);
      expect(panel.fmClient.runScript).not.toHaveBeenCalled();
    });

    it('ignores "copyRequest" without a format it knows', async () => {
      await panel.send({ type: 'copyRequest', payload: script });
      await panel.send({ type: 'copyRequest', payload: { ...script, format: 'cobol' } });
      expect(panel.posted).toEqual([]);
      expect(vi.mocked(vscode.env.clipboard.writeText)).not.toHaveBeenCalled();
    });
  });

  describe('a failure is posted to the webview as an error', () => {
    it('reports a profile that no longer exists', async () => {
      await panel.send({ type: 'loadLayouts', profileId: 'gone' });
      expect(panel.posted).toContainEqual({ type: 'error', message: 'Connection profile not found.' });
      expect(panel.fmClient.listLayouts).not.toHaveBeenCalled();
    });

    it('reads no scripts when the runner is switched off, and offers none', async () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: (key: string, fallback?: unknown) => (key === 'features.scriptRunner.enabled' ? false : fallback)
      } as never);

      await panel.send({ type: 'loadScripts', profileId: 'p1' });

      expect(panel.fmClient.listScripts).not.toHaveBeenCalled();
      expect(panel.posted).toContainEqual({
        type: 'scriptsLoaded',
        payload: { profileId: 'p1', scripts: [] }
      });
    });

    it('reads no scripts in offline mode, and offers none', async () => {
      vi.mocked(vscode.workspace.getConfiguration).mockReturnValue({
        get: (key: string, fallback?: unknown) => (key === 'offline.mode' ? true : fallback)
      } as never);

      await panel.send({ type: 'loadScripts', profileId: 'p1' });

      expect(panel.fmClient.listScripts).not.toHaveBeenCalled();
      expect(panel.posted).toContainEqual({
        type: 'scriptsLoaded',
        payload: { profileId: 'p1', scripts: [] }
      });
    });

    it('logs a script list that cannot be read, and does not fail the panel', async () => {
      panel.fmClient.listScripts.mockRejectedValueOnce(new Error('scripts unavailable'));

      await panel.send({ type: 'loadScripts', profileId: 'p1' });

      expect(panel.logger.warn).toHaveBeenCalledWith(
        'Could not list the scripts of a profile for the script runner.',
        expect.objectContaining({ profileId: 'p1' })
      );
      expect(panel.posted).not.toContainEqual(expect.objectContaining({ type: 'error' }));
    });

    it('reports layouts that cannot be listed', async () => {
      panel.fmClient.listLayouts.mockImplementationOnce(async () => {
        throw new Error('Layouts are unavailable.');
      });
      await panel.send({ type: 'loadLayouts', profileId: 'p1' });
      expect(panel.posted).toContainEqual({ type: 'error', message: 'Layouts are unavailable.' });
    });

    it('reports a script that cannot be run, and logs it', async () => {
      panel.fmClient.runScript.mockImplementationOnce(async () => {
        throw new Error('The script could not be run.');
      });
      await panel.send({ type: 'runScript', payload: script });
      expect(panel.posted).toContainEqual({ type: 'error', message: 'The script could not be run.' });
      expect(panel.logger.warn).toHaveBeenCalledWith('Script runner failed.', expect.anything());
    });

    it('reports a request that cannot be built, and copies nothing', async () => {
      // The format is required for "copyRequest"; without it the message is ignored before the handler runs.
      await panel.send({ type: 'copyRequest', payload: { ...script, scriptName: '.', format: 'http' } });
      expect(vi.mocked(vscode.env.clipboard.writeText)).not.toHaveBeenCalled();
      expect(panel.posted).toContainEqual(
        expect.objectContaining({ type: 'error', message: expect.stringContaining('cannot be used in a request') })
      );
    });
  });
});
