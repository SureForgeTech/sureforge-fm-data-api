import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { createBlankLayout, layoutDefinitionSchema } from '../src/layout-schema';
import { intakeDefinitionSchema, intakeLayout, validateIntakeSubmission } from '../src/intake';
import { LayoutContainer } from '../src/ui-renderer';

describe('intake date instructions', () => {
  it('renders the ISO instruction that intake validation accepts without changing legacy date instructions', () => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const host = document.createElement('div');document.body.appendChild(host);const root = createRoot(host);
    try {
      const source = createBlankLayout('Registration');
      const layout = layoutDefinitionSchema.parse({ ...source, objects: [{ type: 'field',
        id: '11111111-1111-4111-8111-111111111111', name: 'Date', fmFieldName: ' Date ',
        x: 24, y: 24, width: 240, height: 34, format: 'date' }] });
      const definition = intakeDefinitionSchema.parse({ schemaVersion: 1, id: 'registration', layoutId: source.id,
        environmentId: 'sample', title: 'Registration', fields: [{ id: 'date', fmFieldName: ' Date ', label: 'Event date', kind: 'date' }] });
      act(() => root.render(<LayoutContainer layout={intakeLayout(definition, layout)} mode="runtime"
        runtimeData={{ creating: true, editing: true, fieldValues: {} }} />));
      expect(host.textContent).toContain('Use YYYY-MM-DD');
      expect(host.textContent).not.toContain("server's date format");
      expect(validateIntakeSubmission(definition, { date: '2026-11-16' }).valid).toBe(true);
      expect(validateIntakeSubmission(definition, { date: '11/16/2026' }).valid).toBe(false);
      act(() => root.render(<LayoutContainer layout={layout} mode="runtime"
        runtimeData={{ creating: true, editing: true, fieldValues: {} }} />));
      expect(host.textContent).toContain("Use the server's date format");
      expect(host.textContent).not.toContain('Use YYYY-MM-DD');
    } finally { act(() => root.unmount());host.remove(); }
  });
});
