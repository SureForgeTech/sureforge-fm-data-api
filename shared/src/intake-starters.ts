import { createBlankLayout, layoutDefinitionSchema } from './layout-schema';
import { intakeDefinitionSchema, intakeLayout } from './intake';

/** A starter a user can pick in the first-run wizard: an identifier, a label and a synthetic example. */
export interface IntakeStarter {
  /** The identifier the saved app, its file name and its preview route all use. */
  id: string;
  label: string;
  description: string;
  /** The copy a form built from this starter's fields carries. */
  copy: { title: string; description: string; submitLabel: string; successMessage: string };
  example: () => { definition: ReturnType<typeof intakeDefinitionSchema.parse>; layout: ReturnType<typeof layoutDefinitionSchema.parse> };
}

function starterLayout(
  definition: { layoutId: string; fields: Array<{ label: string; fmFieldName: string }> },
  layoutName: string,
  fmLayoutName: string
) {
  const blank = createBlankLayout(layoutName);
  return layoutDefinitionSchema.parse({ ...blank, id: definition.layoutId,
    fmLayoutName, canvas: { ...blank.canvas, width: 640 },
    objects: definition.fields.map((field, index) => ({ type: 'field',
      id: `b1111111-1111-4111-8111-${String(index).padStart(12, '0')}`, name: field.label,
      fmFieldName: field.fmFieldName, x: 24, y: 24 + index * 80, width: 560, height: 34,
      kind: 'normal', label: field.label
    })) });
}

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
  const layout = starterLayout(definition, 'Registration', ' Registrations ');
  return { definition, layout: intakeLayout(definition, layout) };
}

/** Entirely synthetic: no saved profile, server address or customer data is used. */
export function feedbackRequestExample() {
  const definition = intakeDefinitionSchema.parse({
    schemaVersion: 1, id: 'feedback-request', environmentId: 'sample',
    layoutId: 'a2222222-2222-4222-8222-222222222222',
    title: 'Feedback or request form',
    branding: { organizationName: 'Your organization', accentColor: '#215EA6' },
    description: 'Try a feedback or request form with sample data. This private preview does not contact a FileMaker server.',
    submitLabel: 'Send with sample data',
    successMessage: 'Sample feedback accepted. No FileMaker record was created.',
    fields: [
      { id: 'name', fmFieldName: ' Full Name ', label: 'Your name', kind: 'text', required: true, maxLength: 120 },
      { id: 'email', fmFieldName: 'Email Address', label: 'Email address', kind: 'email', required: true, maxLength: 254 },
      { id: 'topic', fmFieldName: 'Topic', label: 'What is this about?', kind: 'select', required: true, options: ['General question', 'Request a call back', 'Report a problem'], maxLength: 40 },
      { id: 'message', fmFieldName: 'Message', label: 'Your message', kind: 'textarea', required: true, helpText: 'Use invented information in this sample.', maxLength: 2000 }
    ]
  });
  const layout = starterLayout(definition, 'Feedback', ' Feedback ');
  return { definition, layout: intakeLayout(definition, layout) };
}

/** The starters the first-run wizard offers, in the order it offers them. */
export const intakeStarters: readonly IntakeStarter[] = [
  { id: 'event-registration', label: 'Event Registration', description: 'Collect names, email and session choices for an event',
    copy: { title: 'Event registration', description: 'Register for our event.', submitLabel: 'Register', successMessage: 'Sample registration accepted. No FileMaker record was created.' },
    example: eventRegistrationExample },
  { id: 'feedback-request', label: 'Feedback or Request Form', description: 'Collect a message, a topic and contact details',
    copy: { title: 'Feedback or request form', description: 'Send us feedback or a request.', submitLabel: 'Send', successMessage: 'Sample message accepted. No FileMaker record was created.' },
    example: feedbackRequestExample }
];

/** The starter with this identifier, or undefined when the identifier names no starter. */
export function starterById(id: string): IntakeStarter | undefined {
  return intakeStarters.find((starter) => starter.id === id);
}
