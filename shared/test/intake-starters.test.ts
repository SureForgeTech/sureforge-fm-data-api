import { describe, expect, it } from 'vitest';
import { eventRegistrationExample, intakeDefinitionSchema, validateIntakeSubmission } from '../src';
describe('reusable portal starter and branding', () => {
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
