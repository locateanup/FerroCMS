/**
 * Forms — editor-defined field lists for collecting public submissions
 * (contact forms, signups, ...). Deliberately built on the same `Field[]`
 * system as collections (reusing `validateFieldList`/`validateEntry` for
 * free) but resolved separately: a form has no entries/drafts/access rules
 * of its own, just a field list and a stream of submissions.
 */

import { humanize, validateFieldList, type Field } from './fields.js';

export interface FormConfig {
  /** URL + storage key, e.g. 'contact'. Lowercase, kebab/snake, unique. */
  slug: string;
  name?: string;
  fields: Field[];
}

export interface ResolvedForm extends FormConfig {
  name: string;
}

const SLUG_RE = /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/;

/** Validate and normalize a form definition. Throws on misconfiguration at startup. */
export function defineForm(config: FormConfig): ResolvedForm {
  if (!SLUG_RE.test(config.slug)) {
    throw new Error(
      `Invalid form slug "${config.slug}": use lowercase letters, numbers, - or _ (must start with a letter).`,
    );
  }
  validateFieldList(config.fields, `Form "${config.slug}"`);
  return { ...config, name: config.name ?? humanize(config.slug) };
}

/** Build a slug -> form lookup, guarding against duplicates. */
export function buildFormRegistry(forms: ResolvedForm[]): Map<string, ResolvedForm> {
  const registry = new Map<string, ResolvedForm>();
  for (const form of forms) {
    if (registry.has(form.slug)) {
      throw new Error(`Duplicate form slug "${form.slug}".`);
    }
    registry.set(form.slug, form);
  }
  return registry;
}
