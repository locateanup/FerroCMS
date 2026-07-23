/**
 * Escape hatch for wholly new field *storage* kinds — not just a different
 * admin widget (see `fieldRegistry` in the admin app for that), but a new
 * `type` string with its own validation logic, registered via
 * `registerFieldType()` in validation.ts. `Field` itself stays a closed,
 * strongly-typed union for the built-ins; this is the one sanctioned place
 * that casts past it.
 */

import type { Field } from './fields.js';

export interface CustomFieldConfig {
  name: string;
  /** Must be registered with `registerFieldType()` before this field is used. */
  type: string;
  label?: string;
  required?: boolean;
  description?: string;
  [extra: string]: unknown;
}

/** Declare a field of a custom type. */
export function defineCustomField(config: CustomFieldConfig): Field {
  return config as unknown as Field;
}
