import { readFileSync } from 'fs';
import { resolve } from 'path';
import vm from 'vm';

import { describe, expect, it, vi } from 'vitest';

/**
 * The Script Runner page reads the timeout the user typed. An empty field means the shared request
 * timeout; a value the run cannot use is refused before the run starts.
 */

interface FakeElement {
  value: string;
  textContent: string;
  children: FakeElement[];
  dataset: Record<string, string>;
  classList: { add: (...tokens: string[]) => void; remove: (...tokens: string[]) => void; toggle: (token: string, force?: boolean) => boolean; contains: (token: string) => boolean };
  addEventListener: (type: string, listener: unknown) => void;
  setAttribute: (name: string, value: string) => void;
  querySelector: (selector: string) => FakeElement | null;
  querySelectorAll: (selector: string) => FakeElement[];
  appendChild: (child: FakeElement) => FakeElement;
  replaceChildren: (...children: FakeElement[]) => void;
  insertAdjacentElement: (position: string, element: FakeElement) => void;
  focus: () => void;
  remove: () => void;
}

function createFakeElement(): FakeElement {
  const element: FakeElement = {
    value: '',
    textContent: '',
    children: [],
    dataset: {},
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      toggle: vi.fn(() => false),
      contains: vi.fn(() => false)
    },
    addEventListener: vi.fn(),
    setAttribute: vi.fn(),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    appendChild: vi.fn((child: FakeElement) => child),
    replaceChildren: vi.fn(),
    insertAdjacentElement: vi.fn(),
    focus: vi.fn(),
    remove: vi.fn()
  };
  return element;
}

/** The page's own reading of the timeout field. */
type ReadTimeoutSeconds = () => number | null | undefined;

function loadTimeoutReader(): { readTimeoutSeconds: ReadTimeoutSeconds; elements: Map<string, FakeElement> } {
  const uiScriptPath = resolve(__dirname, '../../src/webviews/scriptRunner/ui/index.js');
  const source = readFileSync(uiScriptPath, 'utf8');
  const elements = new Map<string, FakeElement>();
  const document = {
    getElementById: (id: string) => {
      let element = elements.get(id);
      if (!element) {
        element = createFakeElement();
        elements.set(id, element);
      }
      return element;
    },
    createElement: () => createFakeElement(),
    querySelector: () => null,
    querySelectorAll: () => []
  };

  const context = vm.createContext({
    acquireVsCodeApi: () => ({ postMessage: vi.fn() }),
    document,
    window: { addEventListener: vi.fn() }
  });

  new vm.Script(source, { filename: uiScriptPath }).runInContext(context);
  const globals = context as Record<string, unknown>;
  expect(globals.readTimeoutSeconds).toBeTypeOf('function');
  return { readTimeoutSeconds: globals.readTimeoutSeconds as ReadTimeoutSeconds, elements };
}

describe('the Script Runner page reads the timeout the user typed', () => {
  it('keeps the shared timeout when the field is empty', () => {
    const { readTimeoutSeconds, elements } = loadTimeoutReader();
    elements.get('timeoutSecondsInput')!.value = '   ';
    expect(readTimeoutSeconds()).toBeUndefined();
  });

  it('reads the seconds the user typed', () => {
    const { readTimeoutSeconds, elements } = loadTimeoutReader();
    elements.get('timeoutSecondsInput')!.value = '120';
    expect(readTimeoutSeconds()).toBe(120);
  });

  it('refuses a value the run cannot use', () => {
    const { readTimeoutSeconds, elements } = loadTimeoutReader();
    const input = elements.get('timeoutSecondsInput')!;
    for (const value of ['0', '601', '12.5', 'abc', '-5']) {
      input.value = value;
      expect(readTimeoutSeconds(), value).toBeNull();
    }
  });
});
