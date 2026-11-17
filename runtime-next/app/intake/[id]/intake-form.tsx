'use client';

import * as React from 'react';
import { LayoutContainer, validateIntakeSubmission, type IntakeDefinition, type IntakeValidationError, type LayoutDefinition } from '@fmweb/shared';

export function IntakeForm({ definition, layout }: { definition: IntakeDefinition; layout: LayoutDefinition }): React.JSX.Element {
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [errors, setErrors] = React.useState<IntakeValidationError[]>([]);
  const [status, setStatus] = React.useState<'editing' | 'submitting' | 'accepted' | 'uncertain'>('editing');
  const [receipt, setReceipt] = React.useState('');
  const [width, setWidth] = React.useState(Math.min(640, layout.canvas.width));
  const busy = React.useRef(false);
  const submissionId = React.useRef<string | undefined>(undefined);
  const canvasHost = React.useRef<HTMLDivElement>(null);
  const summary = React.useRef<HTMLDivElement>(null);
  const locked = status !== 'editing';
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
    if (busy.current) return;
    busy.current = true;
    const checked = validateIntakeSubmission(definition, values);
    if (!checked.valid) { busy.current = false; setErrors(checked.errors); return; }
    setErrors([]); setStatus('submitting');
    submissionId.current ??= crypto.randomUUID();
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
        setErrors([{ code: 'shape', message }]);busy.current = false;setStatus('editing');return;
      }
      const result: unknown = await response.json();
      const body = result && typeof result === 'object' ? result as Record<string, unknown> : {};
      if (response.status === 201 && body.status === 'accepted' && typeof body.receipt === 'string' && /^[a-z0-9-]{1,80}$/i.test(body.receipt)) {
        setReceipt(body.receipt); setStatus('accepted');
      } else if ((response.status === 422 && ['invalid', 'rejected'].includes(String(body.status)))
        || (response.status === 503 && body.status === 'capacity')) {
        setErrors([{ code: 'value', message: body.status === 'capacity'
          ? 'The sample preview reached its limit. Restart the preview to continue.'
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
    <p role="note">Private sample preview. Use invented details. Duplicate protection lasts only while this preview process runs.</p>
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
      <button type="submit" disabled={locked}>{status === 'submitting' ? 'Submitting…' : definition.submitLabel}</button>
    </form>
    <div role="status" aria-live="polite">
      {status === 'accepted' ? <p>{definition.successMessage} Reference: {receipt}</p> : null}
      {status === 'uncertain' ? <p>The submission outcome is uncertain. Keep this page open. This sample has no outcome lookup; reloading or restarting the preview loses duplicate protection and resubmitting could create another registration. Nothing was retried automatically.</p> : null}
    </div>
  </section>;
}
