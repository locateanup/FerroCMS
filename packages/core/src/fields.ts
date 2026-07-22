/**
 * Field definitions for FerroCMS content types.
 *
 * A field is a plain config object discriminated by `type`. From this single
 * definition the system derives: the storage shape (JSONB `data` column),
 * runtime validation (Zod), the admin form control, and the client SDK types.
 */

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
  | 'media';

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
  | TaxonomyField;

/** Derive a default human label from a field/collection machine name. */
export function humanize(name: string): string {
  const spaced = name
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z\d])([A-Z])/g, '$1 $2')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
