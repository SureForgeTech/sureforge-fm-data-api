import { describe, expect, it } from 'vitest';
import { eventRegistrationExample, intakeDefinitionSchema, intakeLayout, migrateIntakeSource, validateIntakeSubmission } from '../src';
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
