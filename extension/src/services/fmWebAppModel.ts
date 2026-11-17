import { randomUUID } from 'crypto';
import { createBlankLayout, intakeDefinitionSchema, runtimeFieldKind, type IntakeDefinition, type IntakeField, type LayoutDefinition } from '@fmweb/shared';
import { standardControlFor } from '@fmweb/shared/dist/field-standards';
import type { DesignerFieldMetadata } from '../fmweb/fieldMetadata';

export function writableAppFields(fields: DesignerFieldMetadata[]): DesignerFieldMetadata[] {
  const names = new Set<string>();
  return fields.filter((field) => {
    if (!field.name || names.has(field.name) || (field.kind && field.kind !== 'normal') || standardControlFor(field).readOnly) return false;
    names.add(field.name);return true;
  });
}

export function registrationAppFromFields(layoutName: string, fields: DesignerFieldMetadata[]): { definition: IntakeDefinition; layout: LayoutDefinition } {
  if (!fields.length || fields.length > 100 || writableAppFields(fields).length !== fields.length) throw new Error('Choose between 1 and 100 writable, nonglobal fields.');
  const layout = createBlankLayout('Event registration', layoutName);
  layout.canvas.width = 640;
  const inputs = fields.map((field, index) => {
    const control = standardControlFor(field);
    const options = field.options && field.options.length <= 100 && field.options.every((item) => item.length > 0 && item.length <= 200)
      ? [...new Set(field.options)] : undefined;
    const type = (field.type ?? '').trim().toLowerCase();
    const kind: IntakeField['kind'] = options?.length ? 'select' : control.kind === 'textarea' ? 'textarea'
      : type === 'number' ? 'number' : type === 'date' ? 'date' : /email/i.test(field.name) ? 'email' : 'text';
    const input = { id: `field-${index + 1}`, fmFieldName: field.name, label: field.name.slice(0, 200), kind,
      required: field.required === true, helpText: '', maxLength: field.maxLength && field.maxLength > 0 ? Math.min(10000, field.maxLength) : 2000,
      options: kind === 'select' ? options : undefined };
    layout.objects.push({ type: 'field', id: randomUUID(), name: input.label, fmFieldName: field.name,
      x: 24, y: 24 + index * 80, width: 560, height: 34, zIndex: index,
      anchors: { top: true, left: true, right: false, bottom: false }, kind: 'normal',
      format: kind === 'number' ? 'number' : kind === 'date' ? 'date' : 'text', label: input.label,
      labelPosition: 'top', required: input.required, multiline: kind === 'textarea',
      displayType: kind === 'select' ? 'dropdown' : 'editBox', options: input.options });
    return input;
  });
  layout.canvas.height = 80 * fields.length + 48;
  const definition = intakeDefinitionSchema.parse({ schemaVersion: 1, id: 'event-registration', environmentId: 'sample',
    layoutId: layout.id, title: 'Event registration', description: 'Register for our event.',
    submitLabel: 'Register', successMessage: 'Sample registration accepted. No FileMaker record was created.',
    branding: { organizationName: '', accentColor: '#215EA6' }, fields: inputs });
  return { definition, layout };
}

/** Include previously unchecked source fields so users can select them again without editing JSON. */
export function editableAppFields(definition: IntakeDefinition, layout: LayoutDefinition): IntakeField[] {
  const existing = new Map(definition.fields.map((field) => [field.fmFieldName, field]));
  const fields: IntakeField[] = [...definition.fields];
  const seen = new Set(existing.keys());
  for (const object of layout.objects) {
    if (object.type !== 'field' || seen.has(object.fmFieldName) || runtimeFieldKind(object) !== 'normal') continue;
    seen.add(object.fmFieldName);
    fields.push({ id: `field-${object.id.replace(/-/g, '')}`, fmFieldName: object.fmFieldName,
      label: (object.label || object.fmFieldName).slice(0, 200), required: object.required, helpText: object.helpText ?? '',
      maxLength: 2000, kind: object.options?.length ? 'select' : object.multiline ? 'textarea' : object.format === 'number' ? 'number' : object.format === 'date' ? 'date' : 'text',
      options: object.options?.length ? object.options : undefined });
  }
  return fields;
}
