import { describe, expect, it } from 'vitest';
import { eventRegistrationExample, intakeLayout } from '@fmweb/shared';
import { editableAppFields, registrationAppFromFields, writableAppFields } from '../../src/services/fmWebAppModel';

describe('FM Web app field selection', () => {
  it('keeps exact FileMaker names and builds editable typed fields', () => {
    const app = registrationAppFromFields(' Registrations ', [
      { name: ' Full Name ', type: 'text', required: true }, { name: 'Email', type: 'text' },
      { name: 'Seats', type: 'number', maxLength: 12 }, { name: 'When', type: 'date' },
      { name: 'Session', options: ['Morning', 'Afternoon'] }, { name: 'Notes', multiline: true }
    ]);
    expect(app.layout.fmLayoutName).toBe(' Registrations ');
    expect(app.definition.fields.map((field) => field.kind)).toEqual(['text', 'email', 'number', 'date', 'select', 'textarea']);
    expect(intakeLayout(app.definition, app.layout).fieldOrder?.[0]).toBe(' Full Name ');
    expect(app.definition.fields[0]).toMatchObject({ required: true, fmFieldName: ' Full Name ' });
    expect(app.definition.environmentId).toBe('sample');
  });
  it('excludes readonly/global/container fields and duplicate exact names', () => {
    expect(writableAppFields([{ name: 'Writable' }, { name: 'Writable' }, { name: 'Calc', kind: 'calculation' },
      { name: 'Global', kind: 'global' }, { name: 'Photo', type: 'container' }, { name: '' }]).map((field) => field.name)).toEqual(['Writable']);
    expect(() => registrationAppFromFields('Layout', [])).toThrow('1 and 100');
    expect(() => registrationAppFromFields('Layout', [{ name: 'Calc', kind: 'summary' }])).toThrow('writable');
  });
  it('keeps selected field identities while exposing unchecked source fields for reselection', () => {
    const app = eventRegistrationExample();
    app.definition.fields = app.definition.fields.slice(0, 1);
    const fields = editableAppFields(app.definition, app.layout);
    expect(fields).toHaveLength(4);expect(fields[0]?.id).toBe('name');
    expect(fields.map((field) => field.fmFieldName)).toContain('Email Address');
  });
});
