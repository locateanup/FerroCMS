/**
 * Derive Zod schemas from field definitions so every write is validated at the
 * API boundary with the exact same rules the admin form uses.
 */

import { z } from 'zod';
import type { Field } from './fields.js';
import { richTextValueSchema } from './richtext.js';

function fieldSchema(field: Field): z.ZodTypeAny {
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
  }
}

/**
 * Build a Zod object schema for a collection's fields.
 * @param opts.partial - make every field optional (for PATCH/update).
 */
export function buildEntrySchema(
  fields: Field[],
  opts: { partial?: boolean } = {},
): z.ZodObject<z.ZodRawShape> {
  const shape: z.ZodRawShape = {};
  for (const field of fields) {
    let schema = fieldSchema(field);
    const isRequired = field.required === true && !opts.partial;
    if (!isRequired) schema = schema.optional();
    shape[field.name] = schema;
  }
  // Reject unknown keys so typos don't silently persist.
  return z.object(shape).strict();
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
  opts: { partial?: boolean } = {},
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
