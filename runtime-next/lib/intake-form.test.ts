// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntakeForm } from '../app/intake/[id]/intake-form';
import { eventRegistrationExample } from './registration-example';

let host: HTMLDivElement;let root: Root;
const accepted = () => Response.json({ status: 'accepted', receipt: 'sample-success' }, { status: 201 });
beforeEach(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');document.body.appendChild(host);root = createRoot(host);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(accepted()));
});
afterEach(() => { act(() => root.unmount());host.remove();vi.unstubAllGlobals();vi.restoreAllMocks(); });
function mount() { const example = eventRegistrationExample();act(() => root.render(React.createElement(IntakeForm, example))); }
function change(name: string, value: string) {
  act(() => {
    const control = host.querySelector<HTMLInputElement | HTMLSelectElement>(`[aria-label="${name}"]`)!;
    if (control instanceof HTMLSelectElement) { control.value = value;control.dispatchEvent(new Event('change', { bubbles: true })); }
    else { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(control, value);control.dispatchEvent(new Event('input', { bubbles: true })); }
  });
}
function fill() { change(' Full Name ', '  Sample Attendee  ');change('Email Address', 'sample@example.test');change('Session', 'Morning'); }
async function submit() { await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }); }

describe('registration form workflow', () => {
  it('renders the existing controls responsively, validates before network and focuses a usable error summary', async () => {
    mount();expect(host.textContent).toContain('Private sample preview');
    expect(host.querySelectorAll('input')).toHaveLength(2);expect(host.querySelector('select')).not.toBeNull();
    expect(host.querySelector('textarea')).not.toBeNull();expect(host.querySelector('[data-mode="runtime"]')).not.toBeNull();
    await submit();expect(fetch).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(host.querySelector('[role="alert"]'));
    act(() => (host.querySelector('[role="alert"] button') as HTMLButtonElement).click());
    expect(document.activeElement).toBe(host.querySelector('[aria-label=" Full Name "]'));
    Object.defineProperty(window, 'innerWidth', { value: 375, configurable: true });
    act(() => window.dispatchEvent(new Event('resize')));
    expect((host.querySelector('[data-mode="runtime"]') as HTMLElement).style.width).toBe('327px');
  });
  it('posts only input ids and values, then reports a sample receipt and prevents further submissions', async () => {
    mount();fill();await submit();expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = vi.mocked(fetch).mock.calls[0];expect(url).toBe('/api/intake/event-registration');
    expect(init).toMatchObject({ method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' } });
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({ submissionId: expect.any(String), values: { name: '  Sample Attendee  ', email: 'sample@example.test', session: 'Morning' } });
    expect(host.querySelector('[role="status"]')?.textContent).toContain('No FileMaker record was created');
    expect(host.textContent).toContain('sample-success');
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    await submit();expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('blocks two submit events synchronously while a request is in flight', async () => {
    let finish!: (response: Response) => void;
    vi.mocked(fetch).mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve; }));
    mount();fill();await submit();await submit();expect(fetch).toHaveBeenCalledTimes(1);
    expect(host.querySelector('form')?.getAttribute('aria-busy')).toBe('true');
    expect(host.querySelector('fieldset')?.disabled).toBe(true);
    await act(async () => { finish(accepted()); });
    expect(host.textContent).toContain('sample-success');
  });
  it.each([
    () => Promise.reject(new Error('synthetic-secret-canary')),
    () => Promise.resolve(Response.json({ status: 'uncertain' }, { status: 409 })),
    () => Promise.resolve(Response.json({ status: 'pending' }, { status: 409 })),
    () => Promise.resolve(Response.json({ status: 'conflict' }, { status: 409 })),
    () => Promise.resolve(Response.json({ status: 'accepted', receipt: 'https://unsafe.test' }, { status: 201 })),
    () => Promise.resolve(new Response('not-json', { status: 502 })),
    () => Promise.resolve(Response.json(null, { status: 500 }))
  ])('keeps uncertain outcomes and drafts without automatic or repeated writes', async (response) => {
    vi.mocked(fetch).mockImplementation(response);mount();fill();await submit();
    expect(host.textContent).toContain('outcome is uncertain');expect(host.textContent).not.toContain('canary');
    expect(host.querySelector<HTMLInputElement>('[aria-label=" Full Name "]')?.value).toBe('  Sample Attendee  ');
    await submit();expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    [{ status: 'invalid' }, 422, 'not accepted'], [{ status: 'rejected' }, 422, 'not accepted'],
    [{ status: 'capacity' }, 503, 'reached its limit']
  ])('keeps values editable after a definite refusal and preserves the identifier on retry', async (body, status, message) => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(body, { status })).mockResolvedValueOnce(accepted());
    mount();fill();await submit();expect(host.textContent).toContain(message);
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    await submit();expect(host.textContent).toContain('sample-success');
    const ids = vi.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)).submissionId);
    expect(ids[1]).toBe(ids[0]);
  });
});
