/**
 * Enforce per-field access rules (see `FieldAccess` in access.ts) on top of
 * collection-level access. Always applied server-side: unreadable fields are
 * stripped before a response goes out, unwritable fields are stripped before
 * a write is validated/persisted.
 */

import type { AccessArgs } from './access.js';
import type { Field } from './fields.js';

type EntryData = Record<string, unknown>;

/** Remove keys the caller isn't allowed to read, per each field's `access.read`. */
export function filterFieldsForRead(fields: Field[], data: EntryData, args: AccessArgs): EntryData {
  const result: EntryData = { ...data };
  for (const field of fields) {
    const check = field.access?.read;
    if (check && field.name in result && !check(args)) {
      delete result[field.name];
    }
  }
  return result;
}

/** Remove keys the caller isn't allowed to write, per each field's `access.update`. */
export function filterFieldsForWrite(
  fields: Field[],
  data: EntryData,
  args: AccessArgs,
): EntryData {
  const result: EntryData = { ...data };
  for (const field of fields) {
    const check = field.access?.update;
    if (check && field.name in result && !check(args)) {
      delete result[field.name];
    }
  }
  return result;
}
