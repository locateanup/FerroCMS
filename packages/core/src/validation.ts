/**
 * Derive Zod schemas from field definitions so every write is validated at the
 * API boundary with the exact same rules the admin form uses.
 */

import { z } from 'zod';
import { evaluateCondition, type Field } from './fields.js';
import { richTextValueSchema } from './richtext.js';

export type FieldSchemaFactory = (field: Field) => z.ZodTypeAny;

const customFieldTypes = new Map<string, FieldSchemaFactory>();

/**
 * Register validation for a custom field type (see `defineCustomField` in
 * customField.ts). A plugin can add a genuinely new field kind — with its
 * own Zod schema — without any change to core.
 */
export function registerFieldType(type: string, schema: FieldSchemaFactory): void {
  customFieldTypes.set(type, schema);
}

export function unregisterFieldType(type: string): void {
  customFieldTypes.delete(type);
}

function fieldSchema(field: Field, opts: BuildEntrySchemaOptions): z.ZodTypeAny {
  const custom = customFieldTypes.get(field.type);
  if (custom) return custom(field);

  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'slug': {
      let s = z.string();
      if ('minLength' in field && field.minLength !== undefined) s = s.min(field.minLength);
      if ('maxLength' in field && field.maxLength !== undefined) s = s.max(field.maxLength);
      return s;
    }
    case 'number': {
      let s = field.integer ? z.number().int() : z.number();
      if (field.min !== undefined) s = s.min(field.min);
      if (field.max !== undefined) s = s.max(field.max);
      return s;
    }
    case 'boolean':
      return z.boolean();
    case 'date':
      // Accept ISO strings; refine to a valid date.
      return z.string().refine((v) => !Number.isNaN(Date.parse(v)), {
        message: 'Invalid date',
      });
    case 'select': {
      const values = field.options.map((o) => o.value);
      if (values.length === 0) return field.many ? z.array(z.string()) : z.string();
      const single = z.enum(values as [string, ...string[]]);
      return field.many ? z.array(single) : single;
    }
    case 'json':
      return z.unknown();
    case 'richText':
      // A structured block array — never raw HTML. See richtext.ts.
      return richTextValueSchema;
    case 'relation': {
      const ref = z.string();
      return field.many ? z.array(ref) : ref;
    }
    case 'media': {
      const ref = z.string();
      return field.many ? z.array(ref) : ref;
    }
    case 'taxonomy': {
      // Taxonomies default to multi-assign (tags/categories usually allow more
      // than one term) unless explicitly set to `many: false`.
      const ref = z.string();
      return field.many === false ? ref : z.array(ref);
    }
    case 'group':
      return buildEntrySchema(field.fields, opts);
    case 'repeater': {
      let s = z.array(buildEntrySchema(field.fields, opts));
      if (field.minRows !== undefined) s = s.min(field.minRows);
      if (field.maxRows !== undefined) s = s.max(field.maxRows);
      return s;
    }
    default:
      // Reached only for a custom field type (see customField.ts) that was
      // never registered with registerFieldType() — fail loudly rather than
      // silently accepting anything.
      throw new Error(
        `Unknown field type "${(field as Field).type}". Register it with registerFieldType() before use.`,
      );
  }
}

export interface BuildEntrySchemaOptions {
  /** Make every field optional (for PATCH/update). */
  partial?: boolean;
  /** The collection's declared locale codes, if it has any localized fields. */
  locales?: string[];
}

/**
 * Build a Zod object schema for a collection's fields.
 * @param opts.partial - make every field optional (for PATCH/update).
 * @param opts.locales - required if any field has `localized: true`; wraps
 *   that field's schema in a partial per-locale record (`{ en: ..., fr: ... }`).
 *   A localized field's `required` is not enforced per-locale — an entry may
 *   have translations filled in incrementally.
 */
export function buildEntrySchema(fields: Field[], opts: BuildEntrySchemaOptions = {}): z.ZodTypeAny {
  const shape: z.ZodRawShape = {};
  // Fields whose `required` only applies when their `admin.condition` holds —
  // enforced below via superRefine, since whether they're required depends on
  // sibling data, not on the field in isolation.
  const conditionallyRequired: Field[] = [];

  for (const field of fields) {
    let schema = fieldSchema(field, opts);
    if (field.localized && opts.locales && opts.locales.length > 0) {
      schema = z.record(z.enum(opts.locales as [string, ...string[]]), schema).optional();
    } else {
      const condition = field.admin?.condition;
      const isRequired = field.required === true && !opts.partial;
      if (isRequired && condition) {
        conditionallyRequired.push(field);
        schema = schema.optional();
      } else if (!isRequired) {
        schema = schema.optional();
      }
    }
    shape[field.name] = schema;
  }

  // Reject unknown keys so typos don't silently persist.
  const base = z.object(shape).strict();
  if (conditionallyRequired.length === 0) return base;

  return base.superRefine((data, ctx) => {
    for (const field of conditionallyRequired) {
      const condition = field.admin!.condition!;
      if (!evaluateCondition(condition, data)) continue;
      const value = (data as Record<string, unknown>)[field.name];
      if (value === undefined || value === null || value === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field.name],
          message: `Required when "${condition.field}" ${
            condition.equals !== undefined
              ? `is ${JSON.stringify(condition.equals)}`
              : condition.notEquals !== undefined
                ? `is not ${JSON.stringify(condition.notEquals)}`
                : 'is truthy'
          }.`,
        });
      }
    }
  });
}

export interface ValidationResult {
  success: boolean;
  data?: Record<string, unknown>;
  errors?: { path: string; message: string }[];
}

/** Validate raw input against a collection's fields, returning a flat error list. */
export function validateEntry(
  fields: Field[],
  input: unknown,
  opts: BuildEntrySchemaOptions = {},
): ValidationResult {
  const schema = buildEntrySchema(fields, opts);
  const result = schema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
}
