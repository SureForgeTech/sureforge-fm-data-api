import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { createBlankLayout, layoutDefinitionSchema } from '../src/layout-schema';
import { intakeDefinitionSchema, intakeLayout, validateIntakeSubmission } from '../src/intake';
import { LayoutContainer } from '../src/ui-renderer';

describe('intake date instructions', () => {
  it('reserves separate lines for short help and an error before the next field', () => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');document.body.appendChild(host);const root = createRoot(host);
    try {
      const source = createBlankLayout('Registration');
      const fields = ['Name', 'Email'].map((name, index) => ({ type: 'field',
        id: `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`, name, fmFieldName: name,
        x: 24, y: 24 + index * 80, width: 560, height: 34, helpText: index === 0 ? 'Short help.' : undefined }));
      const layout = layoutDefinitionSchema.parse({ ...source, objects: fields });
      act(() => root.render(<LayoutContainer layout={layout} mode="runtime" runtimeData={{ creating: true, editing: true,
        viewport: { width: 640, height: 600 }, fieldValues: {}, fieldErrors: { Name: 'This field is required.' } }} />));
      const controls = host.querySelectorAll<HTMLElement>('[data-fm-field-id]');
      expect(parseFloat(controls[0].style.height)).toBeGreaterThanOrEqual(34 + 24 + 2 * 20);
      expect(parseFloat(controls[1].style.top)).toBeGreaterThanOrEqual(parseFloat(controls[0].style.top) + parseFloat(controls[0].style.height) + 16);
      const input = host.querySelector('input')!;
      expect(input.getAttribute('aria-describedby')?.split(' ')).toHaveLength(2);
    } finally { act(() => root.unmount());host.remove(); }
  });
  it('renders the ISO instruction that intake validation accepts without changing legacy date instructions', () => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');document.body.appendChild(host);const root = createRoot(host);
    try {
      const source = createBlankLayout('Registration');
      const layout = layoutDefinitionSchema.parse({ ...source, objects: [{ type: 'field',
        id: '11111111-1111-4111-8111-111111111111', name: 'Date', fmFieldName: ' Date ',
        x: 24, y: 24, width: 240, height: 34, format: 'date' }] });
      const definition = intakeDefinitionSchema.parse({ schemaVersion: 1, id: 'registration', layoutId: source.id,
        environmentId: 'sample', title: 'Registration', fields: [{ id: 'date', fmFieldName: ' Date ', label: 'Event date', kind: 'date', required: true, helpText: 'Choose the workshop date.' }] });
      act(() => root.render(<LayoutContainer layout={intakeLayout(definition, layout)} mode="runtime"
        runtimeData={{ creating: true, editing: true, fieldValues: {} }} />));
      expect(host.textContent).toContain('Use YYYY-MM-DD');
      expect(host.textContent).toContain('Choose the workshop date.');
      expect(host.querySelector('input')?.getAttribute('aria-label')).toBe('Event date');
      expect(host.querySelector('input')?.getAttribute('aria-required')).toBe('true');
      expect(host.textContent).not.toContain("server's date format");
      expect(validateIntakeSubmission(definition, { date: '2026-11-16' }).valid).toBe(true);
      expect(validateIntakeSubmission(definition, { date: '11/16/2026' }).valid).toBe(false);
      act(() => root.render(<LayoutContainer layout={intakeLayout(definition, layout)} mode="runtime"
        runtimeData={{ creating: true, editing: true, fieldValues: {}, fieldErrors: { ' Date ': 'Enter a real ISO date.' } }} />));
      const input = host.querySelector('input')!;
      expect(input.getAttribute('aria-invalid')).toBe('true');
      const error = document.getElementById(input.getAttribute('aria-errormessage')!)!;
      expect(error.textContent).toBe('Enter a real ISO date.');
      expect(input.getAttribute('aria-describedby')).toContain(error.id);
      act(() => root.render(<LayoutContainer layout={layout} mode="runtime"
        runtimeData={{ creating: true, editing: true, fieldValues: {} }} />));
      expect(host.textContent).toContain("Use the server's date format");
      expect(host.textContent).not.toContain('Use YYYY-MM-DD');
      expect(host.querySelector('input')?.getAttribute('aria-label')).toBe(' Date ');
      expect(host.querySelector('input')?.hasAttribute('aria-invalid')).toBe(false);
    } finally { act(() => root.unmount());host.remove(); }
  });
});
