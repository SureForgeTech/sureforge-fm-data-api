import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';

import { FMClientError } from '../../src/services/errors';
import { normalizeError } from '../../src/utils/normalizeError';
import { renderErrorReport, showErrorWithDetails, toShortErrorSummary, toUserErrorMessage } from '../../src/utils/errorUx';

describe('showErrorWithDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows error message with the normalized error message', async () => {
    await showErrorWithDetails(new Error('Something broke'));

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      'Something broke',
      'Details…',
      'Copy as Bug Report'
    );
  });

  it.each([
    { label: 'plain error with Bearer and Basic tokens',
      error: new Error('Request failed: Bearer bearer-secret and Basic YmFzaWMtc2VjcmV0'),
      expected: 'Request failed: Bearer *** and Basic ***', secrets: ['bearer-secret', 'YmFzaWMtc2VjcmV0'] },
    { label: 'URL credentials and query tokens',
      error: new Error('Request failed: https://toast-user:toast-password@example.invalid/data?access_token=query-secret&api_key=key-secret'),
      expected: 'Request failed: https://***@example.invalid/data?access_token=***&api_key=***',
      secrets: ['toast-user', 'toast-password', 'query-secret', 'key-secret'] },
    { label: 'FileMaker session token path',
      error: new Error('DELETE https://example.invalid/fmi/data/vLatest/databases/Contacts/sessions/session-secret failed'),
      expected: 'DELETE https://example.invalid/fmi/data/vLatest/databases/Contacts/sessions/*** failed', secrets: ['session-secret'] },
    { label: 'axios error with an Authorization header',
      error: Object.assign(new Error('Request failed: Authorization: Bearer header-secret'), {
        isAxiosError: true, config: { headers: { Authorization: 'Bearer header-secret' } }
      }), expected: 'Request failed: Authorization: Bearer ***', secrets: ['header-secret'] },
    { label: 'already normalized error',
      error: { kind: 'unknown', message: 'Request failed: Bearer normalized-secret', isRetryable: false },
      expected: 'Request failed: Bearer ***', secrets: ['normalized-secret'] },
    { label: 'client error', error: new FMClientError('Request failed: Basic Y2xpZW50LXNlY3JldA=='),
      expected: 'Request failed: Basic ***', secrets: ['Y2xpZW50LXNlY3JldA=='] },
    { label: 'plain FileMaker message', error: new FMClientError('FileMaker API error [101]: Record is missing'),
      expected: 'FileMaker API error [101]: Record is missing', secrets: [] },
    { label: 'FileMaker response', error: {
      isAxiosError: true, message: 'Request failed', response: {
        status: 500, data: { messages: [{ code: '9999', message: 'A plain FileMaker message.' }] }
      }
    }, expected: 'FileMaker API error (HTTP 500) [9999]: A plain FileMaker message.',
    secrets: [] }
  ])('redacts $label on all normalized message surfaces', async (testCase) => {
    const { error, expected, secrets } = testCase;
    vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(undefined);
    await showErrorWithDetails(error);
    const toast = vi.mocked(vscode.window.showErrorMessage).mock.calls[0]![0];
    // Addresses stay readable in the toast but are broken so they cannot be clicked.
    expect(toast).toBe(expected.replace('https://', 'https: //'));
    expect(normalizeError(error).message).toBe(expected);
    expect(toUserErrorMessage(error, '')).toBe(toast);
    for (const secret of secrets) expect(toast).not.toContain(secret);
  });

  it.each(['Details…', 'Copy as Bug Report'])('contains hostile server text on the toast and %s surface', async (action) => {
    const message = '[Re-enter your password](https://evil)\n```\n# Injected heading\n<img>';
    const error = { isAxiosError: true, message: 'failed', response: {
      status: 500, data: { messages: [{ code: '9999', message }] }
    } };
    vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(action as never);
    await showErrorWithDetails(error);
    const toast = vi.mocked(vscode.window.showErrorMessage).mock.calls[0]![0];
    expect(toast).not.toMatch(/[\r\n]/);
    expect(toast).toContain('[Re-enter your password] (https: //evil)');
    expect(toast).not.toContain('](');
    expect(toast).toContain('```');
    expect(toast).toContain('<img>');
    expect(toUserErrorMessage(error)).toBe(toast);
    const report = action === 'Details…'
      ? (vi.mocked(vscode.workspace.openTextDocument).mock.calls[0]![0] as { content: string }).content
      : vi.mocked(vscode.env.clipboard.writeText).mock.calls[0]![0];
    expect(report).toContain('````\nFileMaker API error');
    expect(report).toContain('\n````\n');
    expect(report).not.toContain('\n# Injected heading');
  });

  it('keeps bracketed codes, Windows paths and angle brackets readable in plain text', () => {
    const message = String.raw`[212] C:\Invoices\Report.jsonl <field>`;
    expect(toUserErrorMessage(new Error(message))).toBe(message);
    expect(toUserErrorMessage(new Error('[click](https://evil)'))).toBe('[click] (https: //evil)');
  });

  it('shows addresses from a server as plain text that cannot be clicked', () => {
    const toast = toUserErrorMessage(new Error('Sign in again at https://evil.example/login or HTTP://EVIL.example, www.evil.example, command://x'));
    expect(toast).toBe('Sign in again at https: //evil.example/login or HTTP: //EVIL.example, www. evil.example, command: //x');
    expect(toast).not.toMatch(/[a-z]:\/\/|www\.\S/i);
  });

  it('keeps plain error text bounded after breaking many injected links', () => {
    const toast = toUserErrorMessage(new Error('[x](https://evil)\n'.repeat(100_000)));
    expect(toast.length).toBeLessThanOrEqual(1025);
    expect(toast).not.toContain('](');
    expect(toast).not.toMatch(/[\r\n]/);
  });

  it('still escapes markup in Markdown report codes', () => {
    const report = renderErrorReport({ kind: 'server', message: 'failed', isRetryable: false,
      code: '[click](https://evil)', networkCode: '<img>' });
    expect(report).toContain(String.raw`**Code:** \[click\](https://evil)`);
    expect(report).toContain(String.raw`**Network code:** \<img\>`);
  });

  it('uses fences longer than hostile backtick runs in report messages, details and stacks', () => {
    const attack = '``````\n# Injected heading\n<img>';
    const report = renderErrorReport({ kind: 'server', message: attack, isRetryable: false,
      details: { message: attack }, stackTrace: attack });
    expect(report.match(/^```````(?:json)?$/gm)).toHaveLength(6);
  });

  it('bounds diagnostic copies of long server messages in details and stacks', () => {
    const message = 'x'.repeat(100_000);
    const report = renderErrorReport({ kind: 'server', message, isRetryable: false,
      details: { messages: [{ message }] }, stackTrace: message });
    expect(report).not.toContain('x'.repeat(16_385));
    expect(report).toContain('… (truncated)');
    expect(report.length).toBeLessThan(40_000);
  });

  it('uses fallback message when error is not an Error', async () => {
    await showErrorWithDetails('string error', {
      fallbackMessage: 'Fallback msg'
    });

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.any(String),
      'Details…',
      'Copy as Bug Report'
    );
  });

  it('calls logger when provided', async () => {
    const logger = { error: vi.fn() };

    await showErrorWithDetails(new Error('fail'), {
      logger,
      logMessage: 'Custom log'
    });

    expect(logger.error).toHaveBeenCalledWith('Custom log', expect.any(Object));
  });

  it('opens markdown document when Details action is selected', async () => {
    vi.mocked(vscode.window.showErrorMessage).mockResolvedValue('Details…' as never);

    await showErrorWithDetails(new Error('fail'));

    expect(vscode.workspace.openTextDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        language: 'markdown',
        content: expect.any(String)
      })
    );
    expect(vscode.window.showTextDocument).toHaveBeenCalled();
  });

  it('does not open document when Details is not selected', async () => {
    vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(undefined as never);

    await showErrorWithDetails(new Error('fail'));

    expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
  });

  it('copies report to clipboard when Copy as Bug Report is selected', async () => {
    vi.mocked(vscode.window.showErrorMessage).mockResolvedValue('Copy as Bug Report' as never);

    await showErrorWithDetails(new Error('boom'));

    expect(vscode.env.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('# FileMaker Data API — Error Report')
    );
    // No document is opened on the copy path.
    expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
  });

  it('does not render the report when toast is dismissed (deferred rendering)', async () => {
    vi.mocked(vscode.window.showErrorMessage).mockResolvedValue(undefined as never);

    // Pass a non-serializable value via a getter that throws — would crash if rendered eagerly.
    const evil = new Error('toxic');
    Object.defineProperty(evil, 'stack', {
      get() {
        throw new Error('do not access');
      }
    });

    await expect(showErrorWithDetails(evil)).resolves.toBeUndefined();
    // Clipboard and document remain untouched because we only render on action.
    expect(vscode.env.clipboard.writeText).not.toHaveBeenCalled();
    expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
  });

  it('signs in again when Reconnect is selected', async () => {
    vi.mocked(vscode.window.showErrorMessage).mockResolvedValue('Reconnect' as never);

    await showErrorWithDetails(
      { kind: 'auth', message: 'Unauthorized', status: 401, isRetryable: false },
      { actions: { profileId: 'p1' } }
    );

    expect(vscode.commands.executeCommand).toHaveBeenCalledWith(
      'filemakerDataApiTools.connect',
      { profileId: 'p1' }
    );
  });

  it('opens the troubleshooting page when Open Troubleshooting is selected', async () => {
    vi.mocked(vscode.window.showErrorMessage).mockResolvedValue('Open Troubleshooting' as never);

    const docsUrl =
      'https://github.com/SureForgeTech/sureforge-fm-data-api/blob/main/extension/docs/TROUBLESHOOTING.md#http-403-the-request-was-refused';
    await showErrorWithDetails({
      kind: 'auth',
      message: 'The server refused the request.',
      status: 403,
      isRetryable: false,
      docsUrl
    });

    expect(vscode.env.openExternal).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(vscode.env.openExternal).mock.calls[0]![0])).toBe(docsUrl);
    // The link opens the page; it does not render a report.
    expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
  });
});

describe('toUserErrorMessage', () => {
  it('extracts message from Error', () => {
    expect(toUserErrorMessage(new Error('oops'))).toBe('oops');
  });

  it('uses fallback for non-Error', () => {
    expect(toUserErrorMessage(null, 'fallback')).toBe('fallback');
  });

  it('uses default fallback', () => {
    expect(toUserErrorMessage(undefined)).toBe('Unexpected error.');
  });
});

describe('toShortErrorSummary', () => {
  it('names the FileMaker code and what it means', () => {
    const error = new FMClientError('The layout is not available.', { code: '105' });

    expect(toShortErrorSummary(error)).toBe('Layout is missing (code 105)');
  });

  it('names an unknown FileMaker code without guessing what it means', () => {
    const error = new FMClientError('Something the server said.', { code: '9999' });

    expect(toShortErrorSummary(error)).toBe('FileMaker error (code 9999)');
  });

  it('does not say the code twice when the meaning already names it', () => {
    const error = new FMClientError('Too many sessions.', { code: '956' });

    expect(toShortErrorSummary(error)).toBe(
      'The maximum number of database or Admin API sessions was exceeded (FileMaker error 956)'
    );
  });

  it('names the kind of connection failure and its network code', () => {
    const refused = {
      isAxiosError: true,
      code: 'ECONNREFUSED',
      message: 'connect ECONNREFUSED',
      config: { url: 'https://fm.example/fmi/data/vLatest/databases/Contacts/sessions' }
    };
    const expired = {
      isAxiosError: true,
      code: 'CERT_HAS_EXPIRED',
      message: 'certificate has expired',
      config: { url: 'https://fm.example/fmi/data/vLatest/databases/Contacts/sessions' }
    };

    expect(toShortErrorSummary(refused)).toBe('Connection problem (ECONNREFUSED)');
    expect(toShortErrorSummary(expired)).toBe('Certificate problem (CERT_HAS_EXPIRED)');
  });

  it('names the kind of failure and the HTTP status when the server answered with one', () => {
    const serverError = new FMClientError('FileMaker request failed (GET /layouts).', { status: 502 });
    const refused = new FMClientError('FileMaker request failed (GET /layouts).', { status: 403 });

    expect(toShortErrorSummary(serverError)).toBe('Server problem (HTTP 502)');
    expect(toShortErrorSummary(refused)).toBe('Sign-in problem (HTTP 403)');
  });

  it('names a timeout and a cancellation', () => {
    const timedOut = new FMClientError('FileMaker request failed (GET /layouts).', { kind: 'timeout' });
    const cancelled = new FMClientError('Request cancelled.', { kind: 'cancellation' });

    expect(toShortErrorSummary(timedOut)).toBe('Timed out');
    expect(toShortErrorSummary(cancelled)).toBe('Cancelled');
  });

  it('keeps the first sentence of a message it cannot classify', () => {
    expect(toShortErrorSummary(new Error('The layout list is empty. Check the profile.')))
      .toBe('The layout list is empty');
  });

  it('falls back when there is no message to show', () => {
    expect(toShortErrorSummary(undefined, 'Could not read the layouts.')).toBe('Could not read the layouts.');
  });

  it('does not show a secret that the message carries', () => {
    expect(toShortErrorSummary(new Error('Request failed: Bearer bearer-secret')))
      .not.toContain('bearer-secret');
  });
});
