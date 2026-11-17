'use client';

import * as React from 'react';
import { LayoutContainer, validateIntakeSubmission, type IntakeDefinition, type IntakeValidationError, type LayoutDefinition } from '@fmweb/shared';

export function IntakeForm({ definition, layout, mode = 'sample' }: { definition: IntakeDefinition; layout: LayoutDefinition; mode?: 'sample' | 'filemaker' }): React.JSX.Element {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [errors, setErrors] = React.useState<IntakeValidationError[]>([]);
  const [status, setStatus] = React.useState<'checking' | 'editing' | 'submitting' | 'accepted' | 'uncertain'>(mode === 'filemaker' ? 'checking' : 'editing');
  const [receipt, setReceipt] = React.useState('');
  const [width, setWidth] = React.useState(Math.min(640, layout.canvas.width));
  const busy = React.useRef(false);
  const submissionId = React.useRef<string | undefined>(undefined);
  const canvasHost = React.useRef<HTMLDivElement>(null);
  const summary = React.useRef<HTMLDivElement>(null);
  const locked = status !== 'editing';
  const attemptKey = `fmweb.registration.v1.${definition.id}.${definition.layoutId}`;
  React.useEffect(() => {
    if (mode !== 'filemaker') return;
    try {
      const stored = sessionStorage.getItem(attemptKey);
      if (!stored) { setStatus('editing');return; }
      const attempt: unknown = JSON.parse(stored);
      const value = attempt && typeof attempt === 'object' ? attempt as Record<string, unknown> : {};
      if (typeof value.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id)) throw new Error('Invalid safety state.');
      submissionId.current = value.id;busy.current = true;
      if (value.state === 'accepted' && typeof value.receipt === 'string' && /^[a-z0-9-]{1,80}$/i.test(value.receipt)) {
        setReceipt(value.receipt);setStatus('accepted');
      } else setStatus('uncertain');
    } catch {
      setErrors([{ code: 'shape', message: 'Registration safety state could not be restored. Enable session storage and ask the app operator to check any earlier submission.' }]);
      setStatus('uncertain');busy.current = true;
    }
  }, [mode, attemptKey]);

  function storeAttempt(state: 'pending' | 'accepted', receipt?: string): void {
    if (mode !== 'filemaker') return;
    const stored = JSON.stringify({ state, id: submissionId.current, ...(receipt ? { receipt } : {}) });
    sessionStorage.setItem(attemptKey, stored);
    if (sessionStorage.getItem(attemptKey) !== stored) throw new Error('Safety state unavailable.');
  }
  function clearAttempt(): void {
    if (mode !== 'filemaker') return;
    sessionStorage.removeItem(attemptKey);
    if (sessionStorage.getItem(attemptKey) !== null) throw new Error('Safety state unavailable.');
  }
  function startAnother(): void {
    try {
      clearAttempt();submissionId.current = undefined;busy.current = false;
      setValues({});setErrors([]);setReceipt('');setStatus('editing');
    } catch { setErrors([{ code: 'shape', message: 'Enable session storage before starting another registration.' }]); }
  }
  React.useEffect(() => { if (errors.length) summary.current?.focus(); }, [errors]);
  React.useEffect(() => {
    const host = canvasHost.current;
    const measure = (): void => setWidth(Math.max(1, Math.min(layout.canvas.width,
      host?.getBoundingClientRect().width || window.innerWidth - 48)));
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    if (host) observer?.observe(host);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [layout.canvas.width]);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy.current || status !== 'editing') return;
    busy.current = true;
    const checked = validateIntakeSubmission(definition, values);
    if (!checked.valid) { busy.current = false; setErrors(checked.errors); return; }
    setErrors([]); setStatus('submitting');
    submissionId.current ??= crypto.randomUUID();
    try { storeAttempt('pending'); }
    catch {
      setErrors([{ code: 'shape', message: 'Your browser cannot save registration safety state. Enable session storage before submitting.' }]);
      busy.current = false;setStatus('editing');return;
    }
    try {
      const response = await fetch(`/api/intake/${definition.id}`, {
        method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: submissionId.current, values }), signal: AbortSignal.timeout(20000)
      });
      // The private server and route reject these requests before any submission write is attempted.
      if ([400, 401, 403, 404, 413, 415].includes(response.status)) {
        const message = response.status === 401 || response.status === 403
          ? 'The preview refused this request before submission. Keep your values and reopen the private preview before trying again.'
          : response.status === 413 ? 'The submission was not sent because it is too large. Shorten your inputs before trying again.'
            : 'The preview did not accept this request. Keep your values and check the form or reopen the preview before trying again.';
        clearAttempt();setErrors([{ code: 'shape', message }]);busy.current = false;setStatus('editing');return;
      }
      const result: unknown = await response.json();
      const body = result && typeof result === 'object' ? result as Record<string, unknown> : {};
      if (response.status === 201 && body.status === 'accepted' && typeof body.receipt === 'string' && /^[a-z0-9-]{1,80}$/i.test(body.receipt)) {
        storeAttempt('accepted', body.receipt);setReceipt(body.receipt); setStatus('accepted');
      } else if ((response.status === 422 && ['invalid', 'rejected'].includes(String(body.status)))
        || (response.status === 503 && body.status === 'capacity')) {
        clearAttempt();if (mode === 'filemaker' && body.status === 'rejected') submissionId.current = undefined;
        setErrors([{ code: 'value', message: body.status === 'capacity'
          ? mode === 'filemaker' ? 'The registration service reached its safety limit. Keep your values and contact the app operator.' : 'The sample preview reached its limit. Restart the preview to continue.'
          : 'The submission was not accepted. Review your values and the form definition before trying again.' }]);
        busy.current = false; setStatus('editing');
      } else setStatus('uncertain');
    } catch { setStatus('uncertain'); }
  }

  function focusField(fieldId: string): void {
    const field = definition.fields.find((item) => item.id === fieldId);
    const object = layout.objects.find((item) => item.type === 'field' && item.fmFieldName === field?.fmFieldName);
    if (object) document.getElementById(`field-input-${object.id}`)?.focus();
  }

  return <section aria-label={definition.title} style={{ borderTop: `6px solid ${definition.branding?.accentColor ?? '#215EA6'}`, paddingTop: 16 }}>
    {definition.branding?.organizationName ? <p>{definition.branding.organizationName}</p> : null}
    <h1>{definition.title}</h1><p>{definition.description}</p>
    <p role="note">{mode === 'filemaker' ? 'Live FileMaker registration. Submitting this form creates a real record in the approved FileMaker connection.' : 'Private sample preview. Use invented details. Duplicate protection lasts only while this preview process runs.'}</p>
    {errors.length ? <div ref={summary} role="alert" tabIndex={-1}>
      <h2>Check your registration</h2><ul>{errors.map((error, index) => <li key={index}>
        {error.fieldId ? <button type="button" onClick={() => focusField(error.fieldId!)}>
          {definition.fields.find((field) => field.id === error.fieldId)?.label}: {error.message}
        </button> : error.message}
      </li>)}</ul>
    </div> : null}
    <form noValidate onSubmit={submit} aria-busy={status === 'submitting'}>
      <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <legend style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>Registration details</legend>
        <div ref={canvasHost} style={{ width: '100%' }}>
          <LayoutContainer layout={layout} mode="runtime" runtimeData={{ creating: true, editing: !locked,
            viewport: { width, height: layout.canvas.height },
            fieldErrors: Object.fromEntries(errors.flatMap((error) => {
              const field = definition.fields.find((item) => item.id === error.fieldId);
              return field ? [[field.fmFieldName, error.message]] : [];
            })),
            fieldValues: Object.fromEntries(definition.fields.map((field) => [field.fmFieldName, values[field.id] ?? ''])),
            onFieldChange: (name, value) => {
              const field = definition.fields.find((item) => item.fmFieldName === name);
              if (field && !busy.current) setValues((current) => ({ ...current, [field.id]: String(value) }));
            }
          }} />
        </div>
      </fieldset>
      <button type="submit" disabled={locked}>{status === 'submitting' ? 'Submitting…' : mode === 'filemaker' && definition.submitLabel === 'Register with sample data' ? 'Register' : definition.submitLabel}</button>
    </form>
    <div role="status" aria-live="polite">
      {status === 'accepted' ? <p>{mode === 'filemaker' ? 'Registration saved to FileMaker.' : definition.successMessage} Reference: {receipt}</p> : null}
      {mode === 'filemaker' && status === 'accepted' ? <button type="button" onClick={startAnother}>Register another attendee</button> : null}
      {status === 'uncertain' ? <p>{mode === 'filemaker'
        ? 'The submission outcome is uncertain. Keep this page open and ask the app operator to check FileMaker before submitting again. A record may already exist. Nothing was retried automatically.'
        : 'The submission outcome is uncertain. Keep this page open. This sample has no outcome lookup; reloading or restarting the preview loses duplicate protection and resubmitting could create another registration. Nothing was retried automatically.'}</p> : null}
    </div>
  </section>;
}
