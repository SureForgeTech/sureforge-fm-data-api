import { vi } from 'vitest';

vi.mock('vscode', () => {
  const createUri = (value: string) => ({ fsPath: value, toString: () => value });
  return {
    window: {
      createWebviewPanel: vi.fn(),
      showErrorMessage: vi.fn(),
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn()
    },
    commands: {
      executeCommand: vi.fn(async () => undefined),
      registerCommand: vi.fn(() => ({ dispose: vi.fn() }))
    },
    Uri: {
      parse: vi.fn((value: string) => createUri(value)),
      file: vi.fn((value: string) => createUri(value)),
      joinPath: vi.fn((_base: { fsPath: string }, ...segments: string[]) => createUri(segments.join('/')))
    },
    ViewColumn: { One: 1 },
    env: { appName: 'Visual Studio Code' }
  };
});
