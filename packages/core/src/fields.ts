/**
 * Field definitions for FerroCMS content types.
 *
 * A field is a plain config object discriminated by `type`. From this single
 * definition the system derives: the storage shape (JSONB `data` column),
 * runtime validation (Zod), the admin form control, and the client SDK types.
 */

import type { FieldAccess } from './access.js';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'slug'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'json'
  | 'richText'
  | 'relation'
  | 'media'
  | 'taxonomy'
  | 'group'
  | 'repeater';

/**
 * A declarative show/hide rule for a field's admin control, evaluated against
 * the current form data (see `evaluateCondition`). Declarative (not a
 * function) because field schemas are sent to the admin as JSON over
 * `/api/collections` — a closure couldn't survive that trip.
 */
export interface FieldCondition {
  /** Name of a sibling field whose value gates this one's visibility. */
  field: string;
  /** Show only when the named field's value strictly equals this. */
  equals?: unknown;
  /** Show only when the named field's value does not strictly equal this. */
  notEquals?: unknown;
  /** Show only when the named field's value is (or isn't) truthy. */
  truthy?: boolean;
}

export interface FieldAdminOptions {
  /** Placeholder shown in the admin input. */
  placeholder?: string;
  /** Hide this field from the admin form (still stored/returned). */
  hidden?: boolean;
  /** Layout width hint for the generated form. */
  width?: 'full' | 'half';
  /** Help text rendered under the control. */
  help?: string;
  /** Group label — fields sharing a group render together in the form. */
  group?: string;
  /** Show this field's control only when the condition holds. See `FieldCondition`. */
  condition?: FieldCondition;
}

/** Evaluate a `FieldCondition` against a form's current data. */
export function evaluateCondition(
  condition: FieldCondition,
  data: Record<string, unknown>,
): boolean {
  const value = data[condition.field];
  if (condition.equals !== undefined) return value === condition.equals;
  if (condition.notEquals !== undefined) return value !== condition.notEquals;
  if (condition.truthy !== undefined) return Boolean(value) === condition.truthy;
  return true;
}

interface BaseField {
  /** Machine name — unique within the collection, used as the JSON key. */
  name: string;
  /** Human label for the admin UI. Defaults to a title-cased `name`. */
  label?: string;
  /** Whether a value is required on create. */
  required?: boolean;
  /** Enforce uniqueness across entries in the collection. */
  unique?: boolean;
  /** Longer description for editors. */
  description?: string;
  /** Per-field read/update access, on top of the collection's own access rules. */
  access?: FieldAccess;
  /**
   * Store a per-locale value (`{ en: "...", fr: "..." }`) instead of a single
   * value. Requires the collection to declare `locales`.
   */
  localized?: boolean;
  admin?: FieldAdminOptions;
}

export interface TextField extends BaseField {
  type: 'text' | 'textarea';
  minLength?: number;
  maxLength?: number;
  defaultValue?: string;
}

export interface SlugField extends BaseField {
  type: 'slug';
  /** Field name to auto-generate the slug from (e.g. 'title'). */
  from?: string;
  defaultValue?: string;
}

export interface NumberField extends BaseField {
  type: 'number';
  min?: number;
  max?: number;
  /** Restrict to integers. */
  integer?: boolean;
  defaultValue?: number;
}

export interface BooleanField extends BaseField {
  type: 'boolean';
  defaultValue?: boolean;
}

export interface DateField extends BaseField {
  type: 'date';
  /** ISO 8601 string. */
  defaultValue?: string;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectField extends BaseField {
  type: 'select';
  options: SelectOption[];
  /** Allow multiple values (stored as an array). */
  many?: boolean;
  defaultValue?: string | string[];
}

export interface JsonField extends BaseField {
  type: 'json';
  defaultValue?: unknown;
}

export interface RichTextField extends BaseField {
  type: 'richText';
}

export interface RelationField extends BaseField {
  type: 'relation';
  /** Slug of the collection this field relates to. */
  relationTo: string;
  /** Allow relating to multiple entries. */
  many?: boolean;
}

export interface MediaField extends BaseField {
  type: 'media';
  /** Allow multiple media items. */
  many?: boolean;
}

export interface TaxonomyField extends BaseField {
  type: 'taxonomy';
  /** Slug of the taxonomy collection (created with `defineTaxonomy`) this field assigns terms from. */
  taxonomy: string;
  /** Allow assigning multiple terms. Default true (most taxonomies are multi-assign, e.g. tags). */
  many?: boolean;
}

/** A nested object of fields — stored as `{ [name]: {...sub-field values} }`. */
export interface GroupField extends BaseField {
  type: 'group';
  fields: Field[];
}

/** A repeatable list of the same sub-field set — stored as an array of objects. */
export interface RepeaterField extends BaseField {
  type: 'repeater';
  fields: Field[];
  minRows?: number;
  maxRows?: number;
}

export type Field =
  | TextField
  | SlugField
  | NumberField
  | BooleanField
  | DateField
  | SelectField
  | JsonField
  | RichTextField
  | RelationField
  | MediaField
  | TaxonomyField
  | GroupField
  | RepeaterField;

/**
 * Validate a (possibly nested) field list: every field has a name, names are
 * unique within this list, relation/taxonomy fields declare their target, and
 * group/repeater sub-fields get the same checks recursively. Does not check
 * reserved top-level column names — only a collection's own direct fields
 * need that (see `defineCollection`), since a field nested inside a group
 * lives at `data.myGroup.name`, not a real column.
 */
export function validateFieldList(fields: Field[], label: string): void {
  if (fields.length === 0) {
    throw new Error(`${label} must declare at least one field.`);
  }
  const seen = new Set<string>();
  for (const field of fields) {
    if (!field.name) throw new Error(`${label} has a field with no name.`);
    if (seen.has(field.name)) throw new Error(`${label} has duplicate field "${field.name}".`);
    seen.add(field.name);
    if (field.type === 'relation' && !field.relationTo) {
      throw new Error(`${label} relation field "${field.name}" is missing "relationTo".`);
    }
    if (field.type === 'taxonomy' && !field.taxonomy) {
      throw new Error(`${label} taxonomy field "${field.name}" is missing "taxonomy".`);
    }
    if (field.type === 'group' || field.type === 'repeater') {
      validateFieldList(field.fields, `${label} > "${field.name}"`);
    }
  }
}

/** Derive a default human label from a field/collection machine name. */
export function humanize(name: string): string {
  const spaced = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
