import { createBlankLayout, layoutDefinitionSchema } from './layout-schema';
import { intakeDefinitionSchema, intakeLayout } from './intake';

/** Entirely synthetic: no saved profile, server address or customer data is used. */
export function eventRegistrationExample() {
  const definition = intakeDefinitionSchema.parse({
    schemaVersion: 1, id: 'event-registration', environmentId: 'sample',
    layoutId: 'a1111111-1111-4111-8111-111111111111',
    title: 'FileMaker builder workshop',
    branding: { organizationName: 'Your organization', accentColor: '#215EA6' },
    description: 'Try a registration form with sample data. This private preview does not contact a FileMaker server.',
    submitLabel: 'Register with sample data',
    successMessage: 'Sample registration accepted. No FileMaker record was created.',
    fields: [
      { id: 'name', fmFieldName: ' Full Name ', label: 'Your name', kind: 'text', required: true, maxLength: 120 },
      { id: 'email', fmFieldName: 'Email Address', label: 'Email address', kind: 'email', required: true, maxLength: 254 },
      { id: 'session', fmFieldName: 'Session', label: 'Workshop session', kind: 'select', required: true, options: ['Morning', 'Afternoon'], maxLength: 20 },
      { id: 'notes', fmFieldName: 'Notes', label: 'Anything we should know?', kind: 'textarea', helpText: 'Use invented information in this sample.', maxLength: 1000 }
    ]
  });
  const blank = createBlankLayout('Registration');
  const layout = layoutDefinitionSchema.parse({ ...blank, id: definition.layoutId,
    fmLayoutName: ' Registrations ', canvas: { ...blank.canvas, width: 640 },
    objects: definition.fields.map((field, index) => ({ type: 'field',
      id: `b1111111-1111-4111-8111-${String(index).padStart(12, '0')}`, name: field.label,
      fmFieldName: field.fmFieldName, x: 24, y: 24 + index * 80, width: 560, height: 34,
      kind: 'normal', label: field.label
    })) });
  return { definition, layout: intakeLayout(definition, layout) };
}
