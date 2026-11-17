import { z } from 'zod';
import { FIELD_LAYOUT } from './field-standards';
import { migrateLayoutDefinition, layoutDefinitionSchema, type LayoutDefinition } from './layout-schema';
import { layoutFieldKind, numericText, runtimeFieldKind } from './record-edit';

export const INTAKE_SCHEMA_VERSION = 1;
const inputId = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
const email = z.email();
const intakeFieldSchema = z.strictObject({
  id: inputId,
  fmFieldName: z.string().min(1).max(1024),
  label: z.string().min(1).max(200),
  kind: z.enum(['text', 'email', 'number', 'date', 'textarea', 'select']),
  required: z.boolean().default(false),
  helpText: z.string().max(1000).default(''),
  maxLength: z.number().int().min(1).max(10000).default(2000),
  options: z.array(z.string().min(1).max(200)).min(1).max(100).optional()
}).superRefine((field, context) => {
  if (field.kind === 'select' && !field.options) {
    context.addIssue({ code: 'custom', path: ['options'], message: 'A selection needs allowed options.' });
  }
  if (field.options && (field.kind !== 'select' || new Set(field.options).size !== field.options.length)) {
    context.addIssue({ code: 'custom', path: ['options'], message: 'Only selections have options, and each option must be unique.' });
  }
});

/** Additive form contract: references an existing FM Web layout, with no credentials or upstream URL. */
export const intakeDefinitionSchema = z.strictObject({
  schemaVersion: z.literal(INTAKE_SCHEMA_VERSION),
  id: inputId,
  layoutId: z.uuid(),
  environmentId: inputId,
  title: z.string().min(1).max(160),
  description: z.string().max(2000).default(''),
  submitLabel: z.string().min(1).max(80).default('Submit'),
  successMessage: z.string().min(1).max(1000).default('Your submission was received.'),
  branding: z.strictObject({
    organizationName: z.string().max(120).default(''),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#215EA6')
  }).optional(),
  fields: z.array(intakeFieldSchema).min(1).max(100)
}).superRefine((definition, context) => {
  const ids = new Set<string>();
  const names = new Set<string>();
  definition.fields.forEach((field, index) => {
    if (ids.has(field.id) || names.has(field.fmFieldName)) {
      context.addIssue({ code: 'custom', path: ['fields', index], message: 'Each input and FileMaker field must be mapped once.' });
    }
    ids.add(field.id);
    names.add(field.fmFieldName);
  });
});

export type IntakeDefinition = z.infer<typeof intakeDefinitionSchema>;
export type IntakeField = IntakeDefinition['fields'][number];
export interface IntakeValidationError {
  fieldId?: string;
  code: 'shape' | 'unknown' | 'required' | 'type' | 'length' | 'value';
  message: string;
}
export type IntakeValidationResult =
  | { valid: true; fieldData: Record<string, string | number> }
  | { valid: false; errors: IntakeValidationError[] };

/** Migrate an authored source while keeping its referenced identity and legacy access hints. */
export function migrateIntakeSource(definition: IntakeDefinition, input: unknown): LayoutDefinition {
  const form = intakeDefinitionSchema.parse(definition);
  const layout = migrateLayoutDefinition(input);
  const raw = input && typeof input === 'object' && !Array.isArray(input) ? input as Record<string, unknown> : {};
  if (raw.schemaVersion === undefined || raw.schemaVersion === 0) {
    if (raw.id !== undefined && raw.id !== form.layoutId) throw new Error('The legacy source belongs to a different layout.');
    // The legacy migration creates an id; the confined source filename already supplies the stable reference here.
    layout.id = form.layoutId;
    const fields = Array.isArray(raw.objects) ? raw.objects : [];
    layout.objects = layout.objects.map((object) => {
      if (object.type !== 'field') return object;
      let kind = runtimeFieldKind(object);
      for (const entry of fields) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
        const original = entry as Record<string, unknown>;
        if (original.fmFieldName !== object.fmFieldName) continue;
        const metadata = original.metadata && typeof original.metadata === 'object' ? original.metadata as Record<string, unknown> : {};
        const text = (value: unknown): string | undefined => typeof value === 'string' ? value : undefined;
        const hinted = runtimeFieldKind({ fmFieldName: object.fmFieldName, kind: text(original.kind), result: text(original.result),
          metadata: { type: text(metadata.type), result: text(metadata.result) } });
        const global = layoutFieldKind({ name: object.fmFieldName, global: original.global ?? metadata.global, type: text(metadata.type) });
        if (hinted !== 'normal') kind = hinted;
        else if (global !== 'normal') kind = global;
      }
      return { ...object, kind };
    });
  }
  return layout;
}

/** The same pure validation runs before browser submission and again at the trusted server adapter. */
export function validateIntakeSubmission(definition: IntakeDefinition, input: unknown): IntakeValidationResult {
  const form = intakeDefinitionSchema.parse(definition);
  if (!input || typeof input !== 'object' || Array.isArray(input)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(input)) || Object.getOwnPropertySymbols(input).length) {
    return { valid: false, errors: [{ code: 'shape', message: 'Submit an object containing the form inputs.' }] };
  }
  const descriptors = Object.getOwnPropertyDescriptors(input);
  const allowed = new Set(form.fields.map((field) => field.id));
  const errors: IntakeValidationError[] = [];
  if (Object.keys(descriptors).some((key) => !allowed.has(key))) {
    errors.push({ code: 'unknown', message: 'The submission contains an input this form does not accept.' });
  }
  const fieldData: Record<string, string | number> = Object.create(null) as Record<string, string | number>;
  for (const field of form.fields) {
    const descriptor = Object.getOwnPropertyDescriptor(descriptors, field.id)?.value as PropertyDescriptor | undefined;
    const value: unknown = descriptor && 'value' in descriptor ? descriptor.value : undefined;
    const error = (code: IntakeValidationError['code'], message: string): void => {
      errors.push({ fieldId: field.id, code, message });
    };
    if (descriptor && (!('value' in descriptor) || typeof value !== 'string')) {
      error('type', 'Enter a text value.');
    } else if (field.required && (value === undefined || (value as string).trim() === '')) {
      error('required', 'This field is required.');
    } else if (value !== undefined) {
      const text = value as string;
      if (text.length > field.maxLength) error('length', `Use at most ${field.maxLength} characters.`);
      else if (text.includes('\0')) error('value', 'Remove the NUL character before submitting.');
      else if (text !== '' && field.kind === 'email' && !email.safeParse(text).success) error('value', 'Enter a valid email address.');
      else if (text !== '' && field.kind === 'number'
        && (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) || !Number.isFinite(Number(text)))) error('value', 'Enter a finite decimal number.');
      else if (text !== '' && field.kind === 'date' && !validIsoDate(text)) error('value', 'Enter a real date in YYYY-MM-DD format.');
      else if (text !== '' && field.kind === 'select' && !field.options!.includes(text)) error('value', 'Choose one of the listed options.');
      else fieldData[field.fmFieldName] = field.kind === 'number' ? numericText(text) : text;
    }
  }
  return errors.length ? { valid: false, errors } : { valid: true, fieldData };
}

function validIsoDate(value: string): boolean {
  if (!/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Derive a form view using the existing renderer; never carry scripts or other field behaviors into it. */
export function intakeLayout(definition: IntakeDefinition, source: LayoutDefinition): LayoutDefinition {
  const form = intakeDefinitionSchema.parse(definition);
  const layout = layoutDefinitionSchema.parse(source);
  if (form.layoutId !== layout.id) throw new Error('The intake definition belongs to a different layout.');
  let y = FIELD_LAYOUT.pageMargin;
  const objects = form.fields.map((field) => {
    const sourceField = layout.objects.find((object) => object.type === 'field' && object.fmFieldName === field.fmFieldName);
    if (!sourceField || sourceField.type !== 'field' || runtimeFieldKind(sourceField) !== 'normal') {
      throw new Error('An intake mapping must name a writable, nonglobal field on its source layout.');
    }
    const height = field.kind === 'textarea' ? FIELD_LAYOUT.multilineHeight : FIELD_LAYOUT.inputHeight;
    const object = {
      ...sourceField, x: FIELD_LAYOUT.pageMargin, y,
      width: Math.max(1, Math.min(560, layout.canvas.width - FIELD_LAYOUT.pageMargin * 2)), height,
      zIndex: 0, behavior: undefined, kind: 'normal' as const,
      format: field.kind === 'number' ? 'number' as const : field.kind === 'date' ? 'date' as const : 'text' as const,
      dateFormat: field.kind === 'date' ? 'iso' as const : undefined,
      label: field.label, accessibleLabel: field.label, helpText: field.helpText, labelPosition: 'top' as const, required: field.required,
      displayType: field.kind === 'select' ? 'dropdown' as const : 'editBox' as const,
      options: field.options, multiline: field.kind === 'textarea'
    };
    y += height + FIELD_LAYOUT.labelSpace + FIELD_LAYOUT.rowGap;
    return object;
  });
  return { ...layout, name: form.title, objects, fieldOrder: form.fields.map((field) => field.fmFieldName),
    canvas: { ...layout.canvas, height: y + FIELD_LAYOUT.pageMargin } };
}
