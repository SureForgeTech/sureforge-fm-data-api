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
  sessionStorage.clear();
  host = document.createElement('div');document.body.appendChild(host);root = createRoot(host);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(accepted()));
});
afterEach(() => { act(() => root.unmount());host.remove();vi.unstubAllGlobals();vi.restoreAllMocks(); });
function mount(mode?: 'sample' | 'filemaker') { const example = eventRegistrationExample();act(() => root.render(React.createElement(IntakeForm, { ...example, mode }))); }
function change(name: string, value: string) {
  act(() => {
    const control = host.querySelector<HTMLInputElement | HTMLSelectElement>(`[aria-label="${name}"]`)!;
    if (control instanceof HTMLSelectElement) { control.value = value;control.dispatchEvent(new Event('change', { bubbles: true })); }
    else { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(control, value);control.dispatchEvent(new Event('input', { bubbles: true })); }
  });
}
function fill() { change('Your name', '  Sample Attendee  ');change('Email address', 'sample@example.test');change('Workshop session', 'Morning'); }
async function submit() { await act(async () => { host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }); }

describe('registration form workflow', () => {
  it('renders the existing controls responsively, validates before network and focuses a usable error summary', async () => {
    mount();expect(host.textContent).toContain('Private sample preview');
    expect(host.textContent).toContain('Your organization');
    expect(host.querySelector('section')?.style.borderTopColor).toBe('rgb(33, 94, 166)');
    expect(host.querySelectorAll('input')).toHaveLength(2);expect(host.querySelector('select')).not.toBeNull();
    expect(host.querySelector('textarea')).not.toBeNull();
    const textarea = host.querySelector('textarea')!;
    expect(document.getElementById(textarea.getAttribute('aria-describedby')!)?.textContent).toContain('Use invented information in this sample.');expect(host.querySelector('[data-mode="runtime"]')).not.toBeNull();
    await submit();expect(fetch).not.toHaveBeenCalled();
    const name = host.querySelector('[aria-label="Your name"]')!;
    expect(name.getAttribute('aria-required')).toBe('true');
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(name.getAttribute('aria-errormessage')!)?.textContent).toBe('This field is required.');
    expect(document.activeElement).toBe(host.querySelector('[role="alert"]'));
    act(() => (host.querySelector('[role="alert"] button') as HTMLButtonElement).click());
    expect(document.activeElement).toBe(host.querySelector('[aria-label="Your name"]'));
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
    expect(host.querySelector<HTMLInputElement>('[aria-label="Your name"]')?.value).toBe('  Sample Attendee  ');
    await submit();expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([
    [401, 'reopen the private preview'], [403, 'reopen the private preview'],
    [400, 'did not accept'], [404, 'did not accept'], [413, 'too large'], [415, 'did not accept']
  ])('keeps a definite pre-submission refusal editable (%i)', async (status, message) => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('Request refused before a write', { status })).mockResolvedValueOnce(accepted());
    mount();fill();await submit();
    expect(host.textContent).toContain(message);expect(host.textContent).not.toContain('outcome is uncertain');
    expect(host.querySelector<HTMLInputElement>('[aria-label="Your name"]')?.value).toBe('  Sample Attendee  ');
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    await submit();expect(fetch).toHaveBeenCalledTimes(2);expect(host.textContent).toContain('sample-success');
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


describe('live FileMaker registration browser behavior', () => {
  const storageKey = () => { const { definition } = eventRegistrationExample();return `fmweb.registration.v1.${definition.id}.${definition.layoutId}`; };
  function remount() { act(() => root.unmount());root = createRoot(host);mount('filemaker'); }
  it('clearly identifies actual writes and uses a real success confirmation instead of the sample success message', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ status:'accepted',receipt:'fm-real-123' },{status:201}));
    mount('filemaker');expect(host.querySelector('[role="note"]')?.textContent).toContain('creates a real record');
    expect(host.querySelector('button[type="submit"]')?.textContent).toBe('Register');fill();await submit();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Submission saved to FileMaker.');
    expect(host.querySelector('[role="status"]')?.textContent).not.toContain('No FileMaker record was created');
    expect(sessionStorage.getItem(storageKey())).not.toContain('Sample Attendee');
    expect(sessionStorage.getItem(storageKey())).not.toContain('sample@example.test');
    expect(JSON.parse(sessionStorage.getItem(storageKey())!)).toMatchObject({state:'accepted',receipt:'fm-real-123'});
  });
  it('restores accepted state after reload and requires an explicit new attendee action', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ status:'accepted',receipt:'fm-real-123' },{status:201}));
    mount('filemaker');fill();await submit();remount();
    expect(host.querySelector('[role="status"]')?.textContent).toContain('fm-real-123');
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);await submit();expect(fetch).toHaveBeenCalledOnce();
    act(() => (Array.from(host.querySelectorAll('button')).find(button=>button.textContent==='Register another attendee')!).click());
    expect(sessionStorage.getItem(storageKey())).toBeNull();expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
  });
  it('preserves a pending safety marker before dispatch and locks uncertain attempts across reload', async () => {
    vi.mocked(fetch).mockImplementationOnce(async () => {
      expect(JSON.parse(sessionStorage.getItem(storageKey())!)).toMatchObject({state:'pending',id:expect.any(String)});
      throw new Error('synthetic-network-failure');
    });
    mount('filemaker');fill();await submit();expect(host.textContent).toContain('outcome is uncertain');remount();
    expect(host.textContent).toContain('outcome is uncertain');expect(host.textContent).not.toContain('loses duplicate protection');
    await submit();expect(fetch).toHaveBeenCalledOnce();
  });
  it('fails closed before a real request if session storage cannot preserve pending state', async () => {
    mount('filemaker');fill();vi.spyOn(Storage.prototype,'setItem').mockImplementationOnce(()=>{throw new Error('storage blocked');});
    await submit();expect(fetch).not.toHaveBeenCalled();expect(host.textContent).toContain('Enable session storage before submitting');
  });
  it('treats unreadable prior safety state as uncertain', async () => {
    sessionStorage.setItem(storageKey(),'{malformed');mount('filemaker');await submit();
    expect(fetch).not.toHaveBeenCalled();expect(host.textContent).toContain('could not be restored');expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
  });
  it('clears a definite rejection and uses a new id only on the next explicit retry', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ status:'rejected' },{status:422})).mockResolvedValueOnce(Response.json({ status:'accepted',receipt:'fm-real-123' },{status:201}));
    mount('filemaker');fill();await submit();expect(sessionStorage.getItem(storageKey())).toBeNull();await submit();
    const ids = vi.mocked(fetch).mock.calls.map(([,init])=>JSON.parse(String(init?.body)).submissionId);expect(ids[1]).not.toBe(ids[0]);expect(fetch).toHaveBeenCalledTimes(2);
  });
});
