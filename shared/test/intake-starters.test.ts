import { describe, expect, it } from 'vitest';
import { appointmentRequestExample, applicationExample, eventRegistrationExample, feedbackRequestExample, intakeDefinitionSchema, intakeLayout, intakeStarters, migrateIntakeSource, serviceInquiryExample, starterById, validateIntakeSubmission } from '../src';
describe('reusable portal starter and branding', () => {
  it('migrates legacy sources with a stable reference and exact names', () => {
    const { definition, layout } = eventRegistrationExample();
    const migrated = migrateIntakeSource(definition, { ...layout, schemaVersion: 0 });
    expect(migrated.id).toBe(definition.layoutId);
    expect(intakeLayout(definition, migrated).objects[0]).toMatchObject({ fmFieldName: ' Full Name ' });
    expect(() => migrateIntakeSource(definition, { ...layout, schemaVersion: 0, id: 'another' })).toThrow('different');
    expect(() => migrateIntakeSource(definition, { ...layout, schemaVersion: 99 })).toThrow('newer');
  });
  it.each([{ kind: 'calculation' }, { result: 'summary' }, { result: 'container' }, { kind: 'global' }, { global: true }, { metadata: { type: 'calculation' } }, { metadata: { type: 'global' } }, { metadata: { global: true } }])('does not erase legacy readonly/global hints %j', (hint) => {
    const { definition, layout } = eventRegistrationExample();
    const source = { ...layout, schemaVersion: 0, objects: layout.objects.map((object, index) => index ? object : { ...object, ...hint }) };
    expect(() => intakeLayout(definition, migrateIntakeSource(definition, source))).toThrow('writable');
  });

  it('keeps current sources intact, handles missing legacy ids and rejects unmapped legacy shapes', () => {
    const { definition, layout } = eventRegistrationExample();
    expect(migrateIntakeSource(definition, layout)).toEqual(layout);
    const withoutId: Record<string, unknown> = { ...layout };
    delete withoutId.id;
    const migrated = migrateIntakeSource(definition, { ...withoutId, schemaVersion: 0, objects: [null, [], 7, { type: 'text', text: 'Instructions' }, ...layout.objects] });
    expect(migrated.id).toBe(definition.layoutId);
    expect(intakeLayout(definition, migrated).objects).toHaveLength(definition.fields.length);
    expect(() => intakeLayout(definition, migrateIntakeSource(definition, null))).toThrow('writable');
  });
  it('keeps a readonly hint when legacy data repeats a field with later normal entries', () => {
    const { definition, layout } = eventRegistrationExample();
    const first = layout.objects[0];
    const source = { ...layout, schemaVersion: 0, objects: [{ ...first, kind: 'calculation' }, ...layout.objects] };
    expect(() => intakeLayout(definition, migrateIntakeSource(definition, source))).toThrow('writable');
  });
  it('has exact stable mappings and validates only invented sample values', () => {
    const sample = eventRegistrationExample();
    expect(sample.layout.fmLayoutName).toBe(' Registrations ');
    expect(sample.definition.fields[0].fmFieldName).toBe(' Full Name ');
    expect(validateIntakeSubmission(sample.definition, { name: 'Sample', email: 'sample@example.test', session: 'Morning' }).valid).toBe(true);
    expect(eventRegistrationExample()).toEqual(sample);
  });
  it('accepts legacy definitions and refuses CSS, URLs, credentials or unknown branding options', () => {
    const { definition } = eventRegistrationExample();
    expect(intakeDefinitionSchema.safeParse({ ...definition, branding: undefined }).success).toBe(true);
    expect(intakeDefinitionSchema.parse({ ...definition, branding: {} }).branding).toEqual({ organizationName: '', accentColor: '#215EA6' });
    for (const branding of [{ accentColor: 'url(https://example.test)' }, { accentColor: '#000;display:none' }, { logoUrl: 'https://example.test' }, { password: 'synthetic' }]) {
      expect(intakeDefinitionSchema.safeParse({ ...definition, branding }).success).toBe(false);
    }
  });
});

describe('the starter catalogue the first-run wizard offers', () => {
  it('offers the web activities a FileMaker solution is asked for most', () => {
    expect(intakeStarters.map((starter) => starter.id)).toEqual(['event-registration', 'feedback-request', 'service-inquiry', 'appointment-request', 'application']);
    expect(intakeStarters.map((starter) => starter.label)).toEqual(['Event Registration', 'Feedback or Request Form', 'Service Inquiry', 'Appointment Request', 'Application']);
    expect(intakeStarters.every((starter) => starter.description.length > 0)).toBe(true);
  });
  it('resolves a starter by identifier and refuses an unknown one', () => {
    expect(starterById('feedback-request')?.label).toBe('Feedback or Request Form');
    expect(starterById('event-registration')?.label).toBe('Event Registration');
    expect(starterById('service-inquiry')?.label).toBe('Service Inquiry');
    expect(starterById('appointment-request')?.label).toBe('Appointment Request');
    expect(starterById('application')?.label).toBe('Application');
    expect(starterById('other')).toBeUndefined();
    expect(starterById('')).toBeUndefined();
  });
  it('gives every starter its own copy for a form built from its fields', () => {
    expect(intakeStarters.map((starter) => starter.copy.title)).toEqual(['Event registration', 'Feedback or request form', 'Service inquiry', 'Appointment request', 'Application']);
    expect(intakeStarters.map((starter) => starter.copy.submitLabel)).toEqual(['Register', 'Send', 'Send inquiry', 'Request appointment', 'Submit application']);
    expect(intakeStarters.every((starter) => starter.copy.description.length > 0 && starter.copy.successMessage.length > 0)).toBe(true);
    expect(new Set(intakeStarters.map((starter) => starter.copy.title)).size).toBe(intakeStarters.length);
  });
  it('gives every starter its own identifier, layout and exact field names', () => {
    const ids = new Set<string>();
    for (const starter of intakeStarters) {
      const { definition, layout } = starter.example();
      expect(definition.id).toBe(starter.id);
      expect(definition.environmentId).toBe('sample');
      expect(definition.id).toMatch(/^[a-z][a-z0-9_-]{0,63}$/);
      expect(ids.has(definition.id)).toBe(false);ids.add(definition.id);
      expect(layout.id).toBe(definition.layoutId);
      expect(layout.objects).toHaveLength(definition.fields.length);
      for (const object of layout.objects) {
        if (object.type !== 'field') continue;
        expect(object.fmFieldName.trim().length).toBeGreaterThan(0);
      }
    }
  });
  it('builds a feedback form that validates only invented sample values', () => {
    const sample = feedbackRequestExample();
    expect(sample.definition.title).toBe('Feedback or request form');
    expect(sample.definition.fields.map((field) => field.fmFieldName)).toEqual([' Full Name ', 'Email Address', 'Topic', 'Message']);
    expect(sample.layout.fmLayoutName).toBe(' Feedback ');
    expect(validateIntakeSubmission(sample.definition, { name: 'Sample', email: 'sample@example.test', topic: 'General question', message: 'Invented' }).valid).toBe(true);
    expect(validateIntakeSubmission(sample.definition, { name: 'Sample', email: 'sample@example.test', topic: 'General question' }).valid).toBe(false);
    expect(feedbackRequestExample()).toEqual(sample);
  });
  it('builds an appointment request that asks for a real date', () => {
    const sample = appointmentRequestExample();
    expect(sample.definition.fields.map((field) => field.fmFieldName)).toEqual([' Full Name ', 'Email Address', 'Preferred Date', 'Preferred Time', 'Reason']);
    expect(sample.definition.fields.find((field) => field.id === 'date')?.kind).toBe('date');
    expect(sample.layout.fmLayoutName).toBe(' Appointments ');
    const values = { name: 'Sample', email: 'sample@example.test', date: '2026-11-24', time: 'Morning', reason: 'Invented' };
    expect(validateIntakeSubmission(sample.definition, values).valid).toBe(true);
    expect(validateIntakeSubmission(sample.definition, { ...values, date: '2026-11-31' }).valid).toBe(false);
    expect(validateIntakeSubmission(sample.definition, { ...values, date: 'next Tuesday' }).valid).toBe(false);
    expect(appointmentRequestExample()).toEqual(sample);
  });
  it('builds a service inquiry and an application with their own fields', () => {
    const inquiry = serviceInquiryExample();
    expect(inquiry.definition.fields.map((field) => field.fmFieldName)).toEqual([' Full Name ', 'Email Address', 'Service Needed', 'Message']);
    expect(inquiry.layout.fmLayoutName).toBe(' Inquiries ');
    expect(validateIntakeSubmission(inquiry.definition, { name: 'Sample', email: 'sample@example.test', service: 'Advice', message: 'Invented' }).valid).toBe(true);
    const application = applicationExample();
    expect(application.definition.fields.map((field) => field.fmFieldName)).toEqual([' Full Name ', 'Email Address', 'Role or Program', 'About You']);
    expect(application.layout.fmLayoutName).toBe(' Applications ');
    expect(validateIntakeSubmission(application.definition, { name: 'Sample', email: 'sample@example.test', role: 'Support', about: 'Invented' }).valid).toBe(true);
    expect(serviceInquiryExample()).toEqual(inquiry);
    expect(applicationExample()).toEqual(application);
  });
});
