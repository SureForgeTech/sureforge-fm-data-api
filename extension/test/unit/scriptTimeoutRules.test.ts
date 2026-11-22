import { readFileSync } from 'fs';
import { resolve } from 'path';
import vm from 'vm';

import { describe, expect, it, vi } from 'vitest';

import { effectiveTimeout, hasOwnDeadline } from '../../src/services/requestLimits';

/**
 * The deadline a request uses, and the two rules around it: a value that is not a usable deadline
 * falls back to the shared timeout, and a copy of the request carries no deadline at all.
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
  return {
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
}

type CollectPayload = (needsTimeout: boolean) => Record<string, unknown> | undefined;

function loadPage(): { collectPayload: CollectPayload; elements: Map<string, FakeElement> } {
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
  expect(globals.collectPayload).toBeTypeOf('function');
  return { collectPayload: globals.collectPayload as CollectPayload, elements };
}

describe('the deadline a request uses', () => {
  it('is the request\'s own when it asked for a usable one', () => {
    expect(effectiveTimeout(600_000, 15_000)).toBe(600_000);
    expect(effectiveTimeout(1_000, 15_000)).toBe(1_000);
  });

  it('knows whether a request carried a deadline it can use', () => {
    expect(hasOwnDeadline(600_000)).toBe(true);
    expect(hasOwnDeadline(1)).toBe(true);
    expect(hasOwnDeadline(undefined)).toBe(false);
    expect(hasOwnDeadline(0)).toBe(false);
    expect(hasOwnDeadline(-1)).toBe(false);
    expect(hasOwnDeadline(Number.NaN)).toBe(false);
    expect(hasOwnDeadline(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('is the shared timeout when the request asked for nothing usable', () => {
    expect(effectiveTimeout(undefined, 15_000)).toBe(15_000);
    expect(effectiveTimeout(0, 15_000)).toBe(15_000);
    expect(effectiveTimeout(-1, 15_000)).toBe(15_000);
    expect(effectiveTimeout(Number.NaN, 15_000)).toBe(15_000);
    expect(effectiveTimeout(Number.POSITIVE_INFINITY, 15_000)).toBe(15_000);
  });
});

describe('the Script Runner page', () => {
  it('refuses a run whose timeout it cannot use', () => {
    const { collectPayload, elements } = loadPage();
    elements.get('profileSelect')!.value = 'p1';
    elements.get('layoutSelect')!.value = 'Contacts';
    elements.get('scriptNameInput')!.value = 'Echo';
    elements.get('timeoutSecondsInput')!.value = '5000';

    expect(collectPayload(true)).toBeUndefined();
  });

  it('still copies the request when the timeout box holds a value a run cannot use', () => {
    const { collectPayload, elements } = loadPage();
    elements.get('profileSelect')!.value = 'p1';
    elements.get('layoutSelect')!.value = 'Contacts';
    elements.get('scriptNameInput')!.value = 'Echo';
    elements.get('timeoutSecondsInput')!.value = '5000';

    const payload = collectPayload(false);
    expect(payload).toBeDefined();
    expect(payload).not.toHaveProperty('timeoutSeconds');
  });
});
