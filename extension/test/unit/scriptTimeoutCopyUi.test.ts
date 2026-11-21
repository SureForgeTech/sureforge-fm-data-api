import { readFileSync } from 'fs';
import { resolve } from 'path';
import vm from 'vm';

import { describe, expect, it, vi } from 'vitest';

/**
 * The page must not let a value in the timeout box refuse a copy of the request: a copy carries no
 * deadline, so the box is none of its business.
 */

interface FakeElement {
  value: string;
  textContent: string;
  children: FakeElement[];
  dataset: Record<string, string>;
  checked: boolean;
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
  listeners: Map<string, (() => void)[]>;
}

function createFakeElement(): FakeElement {
  const listeners = new Map<string, (() => void)[]>();
  return {
    value: '',
    textContent: '',
    children: [],
    dataset: {},
    checked: false,
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      toggle: vi.fn(() => false),
      contains: vi.fn(() => false)
    },
    addEventListener: (type: string, listener: unknown) => {
      const known = listeners.get(type) ?? [];
      known.push(listener as () => void);
      listeners.set(type, known);
    },
    setAttribute: vi.fn(),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => []),
    appendChild: vi.fn((child: FakeElement) => child),
    replaceChildren: vi.fn(),
    insertAdjacentElement: vi.fn(),
    focus: vi.fn(),
    remove: vi.fn(),
    listeners
  };
}

function loadPage(): { elements: Map<string, FakeElement>; posted: Array<Record<string, unknown>>; buttons: FakeElement[] } {
  const uiScriptPath = resolve(__dirname, '../../src/webviews/scriptRunner/ui/index.js');
  const source = readFileSync(uiScriptPath, 'utf8');
  const elements = new Map<string, FakeElement>();
  const buttons: FakeElement[] = [];
  const posted: Array<Record<string, unknown>> = [];
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
    querySelectorAll: (selector: string) => (selector === '[data-copy-format]' ? buttons : [])
  };

  const context = vm.createContext({
    acquireVsCodeApi: () => ({
      postMessage: (message: Record<string, unknown>) => {
        posted.push(message);
        return true;
      }
    }),
    document,
    window: { addEventListener: vi.fn() }
  });

  // The copy button exists before the page loads, so the page registers its handler on it.
  const button = createFakeElement();
  button.dataset.copyFormat = 'curl';
  buttons.push(button);

  new vm.Script(source, { filename: uiScriptPath }).runInContext(context);

  return { elements, posted, buttons };
}

describe('the Script Runner page copies the request even when the timeout box holds a bad value', () => {
  it('posts the copy and does not refuse it', () => {
    const { elements, posted, buttons } = loadPage();
    elements.get('profileSelect')!.value = 'p1';
    elements.get('layoutSelect')!.value = 'Contacts';
    elements.get('scriptNameInput')!.value = 'Echo';
    elements.get('timeoutSecondsInput')!.value = '5000';

    for (const listener of buttons[0]!.listeners.get('click') ?? []) {
      listener();
    }

    expect(posted).toContainEqual(
      expect.objectContaining({
        type: 'copyRequest',
        payload: expect.objectContaining({ scriptName: 'Echo', format: 'curl' })
      })
    );
    expect(posted.some((message) => message.type === 'error')).toBe(false);
  });
});
