import { describe, expect, it } from 'vitest';
import { createBlankLayout, layoutDefinitionSchema } from '../src/layout-schema';
import { intakeDefinitionSchema, intakeLayout, validateIntakeSubmission, type IntakeDefinition } from '../src/intake';

function form(overrides: Record<string, unknown> = {}): IntakeDefinition {
  return intakeDefinitionSchema.parse({ schemaVersion: 1, id: 'registration',
    layoutId: '11111111-1111-4111-8111-111111111111', environmentId: 'development', title: 'Event registration',
    fields: [{ id: 'name', fmFieldName: ' Name ', label: 'Your name', kind: 'text', required: true }], ...overrides });
}
function field(kind: string, extra: Record<string, unknown> = {}): IntakeDefinition {
  return form({ fields: [{ id: 'value', fmFieldName: ' Exact::Field ', label: 'Value', kind, ...extra }] });
}
function source(definition = form()) {
  const layout = createBlankLayout('Source');
  layout.id = definition.layoutId;
  return layoutDefinitionSchema.parse({ ...layout, objects: definition.fields.map((item, index) => ({
    type: 'field', id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, name: item.fmFieldName,
    fmFieldName: item.fmFieldName, x: 10, y: 10, width: 200, height: 34, kind: 'normal',
    behavior: { type: 'runScript', scriptName: 'Must not run' }
  })) });
}

describe('versioned intake contracts', () => {
  it('preserves exact field names and fills presentation defaults without accepting credentials', () => {
    const definition = form();
    expect(definition.fields[0].fmFieldName).toBe(' Name ');
    expect(definition.submitLabel).toBe('Submit');
    expect(definition.fields[0]).toMatchObject({ helpText: '', maxLength: 2000 });
    for (const extra of [{ schemaVersion: 2 }, { password: 'not-a-real-password' }, { serverUrl: 'https://example.test' }]) {
      expect(() => form(extra)).toThrow();
    }
  });
  it('rejects repeated ids, repeated exact mappings, unusable choices and unbounded definitions', () => {
    const original = form().fields[0];
    for (const fields of [[], [original, { ...original, fmFieldName: 'Other' }], [original, { ...original, id: 'other' }],
      [{ ...original, kind: 'select' }], [{ ...original, options: ['a'] }],
      [{ ...original, kind: 'select', options: ['a', 'a'] }], [{ ...original, maxLength: 10001 }]]) {
      expect(() => form({ fields })).toThrow();
    }
    expect(form({ fields: [original, { ...original, id: 'other', fmFieldName: 'Name' }] }).fields).toHaveLength(2);
  });
});

describe('shared submission validation', () => {
  it.each([null, false, 42, 'text', [], new Date(), Object.create({ inherited: 'value' }), { [Symbol('extra')]: 'x' }])
    ('refuses non-object and non-JSON inputs without echoing their contents', (input) => {
      expect(validateIntakeSubmission(form(), input)).toMatchObject({ valid: false, errors: [{ code: 'shape' }] });
    });
  it('reports required, unknown and invalid types without returning a partial write', () => {
    for (const input of [{}, { name: '' }, { name: ' \t\n' }]) {
      expect(validateIntakeSubmission(form(), input)).toMatchObject({ valid: false, errors: [{ fieldId: 'name', code: 'required' }] });
    }
    for (const value of [null, true, 123, [], {}]) {
      expect(validateIntakeSubmission(form(), { name: value })).toMatchObject({ valid: false, errors: [{ code: 'type' }] });
    }
    const result = validateIntakeSubmission(form(), { name: 'Ada', layout: 'Secret target', token: 'synthetic-secret' });
    expect(result).toMatchObject({ valid: false, errors: [{ code: 'unknown' }] });
    expect(JSON.stringify(result)).not.toMatch(/Secret target|synthetic-secret|fieldData/);
  });
  it('does not invoke input getters or mistake inherited properties for submitted fields', () => {
    let reads = 0;
    const input = Object.defineProperty({}, 'name', { enumerable: true, get() { reads++; return 'Ada'; } });
    expect(validateIntakeSubmission(form(), input)).toMatchObject({ valid: false, errors: [{ code: 'type' }] });
    expect(reads).toBe(0);
    const definition = form({ fields: [{ ...form().fields[0], id: 'constructor', fmFieldName: '__proto__' }] });
    expect(validateIntakeSubmission(definition, {})).toMatchObject({ valid: false });
    const result = validateIntakeSubmission(definition, { constructor: 'safe data' });
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(Object.getPrototypeOf(result.fieldData)).toBeNull();
      expect(Object.getOwnPropertyDescriptor(result.fieldData, '__proto__')?.value).toBe('safe data');
    }
  });
  it('keeps exact text and supports optional missing or explicitly empty values', () => {
    expect(validateIntakeSubmission(form(), { name: '  Ada\r\nLovelace  ' })).toMatchObject({ valid: true, fieldData: { ' Name ': '  Ada\r\nLovelace  ' } });
    expect(validateIntakeSubmission(field('text'), {})).toMatchObject({ valid: true, fieldData: {} });
    expect(validateIntakeSubmission(field('number'), { value: '' })).toMatchObject({ valid: true, fieldData: { ' Exact::Field ': '' } });
    expect(validateIntakeSubmission(field('text'), Object.assign(Object.create(null), { value: 'yes' }))).toMatchObject({ valid: true });
  });
  it.each([
    ['text', 'abcd', { maxLength: 3 }, 'length'], ['text', 'a\0b', {}, 'value'],
    ['email', 'not-email', {}, 'value'], ['number', '0x10', {}, 'value'], ['number', 'Infinity', {}, 'value'],
    ['number', '9'.repeat(400), {}, 'value'], ['number', '1e3', {}, 'value'],
    ['date', '2026-02-29', {}, 'value'], ['date', '0000-01-01', {}, 'value'], ['date', '01/01/2026', {}, 'value'],
    ['date', '2026-99-99', {}, 'value'], ['select', 'other', { options: ['one'] }, 'value']
  ])('rejects invalid %s input', (kind, value, options, code) => {
    expect(validateIntakeSubmission(field(kind, options), { value })).toMatchObject({ valid: false, errors: [{ fieldId: 'value', code }] });
  });
  it.each([
    ['email', 'ada@example.test', {}], ['number', '12.5', {}], ['number', '-.5', {}], ['date', '2028-02-29', {}],
    ['select', ' One ', { options: [' One ', 'Two'] }], ['textarea', 'one\ntwo', {}]
  ])('accepts valid %s input', (kind, value, options) => {
    expect(validateIntakeSubmission(field(kind, options), { value }).valid).toBe(true);
  });
  it('uses the existing numeric conversion without rounding large FileMaker values', () => {
    expect(validateIntakeSubmission(field('number'), { value: '9007199254740993' })).toMatchObject({ valid: true, fieldData: { ' Exact::Field ': '9007199254740993' } });
    expect(validateIntakeSubmission(field('number'), { value: '12.5' })).toMatchObject({ valid: true, fieldData: { ' Exact::Field ': 12.5 } });
  });
});

describe('reusing the existing layout renderer', () => {
  it('derives field order and presentation while dropping actions and preserving the original layout', () => {
    const definition = form({ fields: [
      { id: 'notes', fmFieldName: 'Notes', label: 'Notes', kind: 'textarea' },
      { id: 'choice', fmFieldName: 'Choice', label: 'Choice', kind: 'select', options: ['one'] },
      { id: 'number', fmFieldName: 'Number', label: 'Number', kind: 'number' },
      { id: 'date', fmFieldName: 'Date', label: 'Date', kind: 'date' }
    ] });
    const original = source(definition); const before = JSON.stringify(original);
    const view = intakeLayout(definition, original);
    expect(JSON.stringify(original)).toBe(before);
    expect(view.name).toBe(definition.title);
    expect(view.fieldOrder).toEqual(['Notes', 'Choice', 'Number', 'Date']);
    expect(view.objects[0]).toMatchObject({ multiline: true, height: 96, labelPosition: 'top' });
    expect(view.objects[1]).toMatchObject({ displayType: 'dropdown', options: ['one'] });
    expect(view.objects[2]).toMatchObject({ format: 'number' });
    expect(view.objects[3]).toMatchObject({ format: 'date' });
    expect(view.objects.every((object) => !object.behavior)).toBe(true);
    expect(view.canvas.height).toBeGreaterThan(view.objects[3].y + view.objects[3].height);
    expect(layoutDefinitionSchema.safeParse(view).success).toBe(true);
  });
  it('refuses the wrong layout and fields missing or unavailable for registration writes', () => {
    const definition = form(); const original = source();
    expect(() => intakeLayout({ ...definition, layoutId: '22222222-2222-4222-8222-222222222222' }, original)).toThrow(/different layout/);
    expect(() => intakeLayout(definition, { ...original, objects: [] })).toThrow(/writable/);
    for (const kind of ['calculation', 'summary', 'container', 'global'] as const) {
      expect(() => intakeLayout(definition, { ...original, objects: original.objects.map((object) => ({ ...object, kind })) })).toThrow(/writable/);
    }
  });
});
