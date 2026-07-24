/**
 * Globals — a single reusable document per slug (site settings, header/footer
 * nav, a homepage config) rather than a list of entries. Deliberately not a
 * `ResolvedCollection`: no drafts, no list view, no create/delete — just
 * read/update on the one document. Kept separate from `defineCollection` so
 * the regular `/api/:collection` CRUD routes never see (and can't
 * accidentally list/create/delete against) a global.
 */

import { humanize, validateFieldList, type Field } from './fields.js';
import { anyone, atLeast, type AccessFn } from './access.js';

export interface GlobalAccess {
  read?: AccessFn;
  update?: AccessFn;
}

export interface GlobalConfig {
  /** URL + storage key, e.g. 'site-settings'. Lowercase, kebab/snake, unique. */
  slug: string;
  label?: string;
  fields: Field[];
  /** Defaults: anyone can read, editors+ can update. */
  access?: GlobalAccess;
}

export interface ResolvedGlobal extends GlobalConfig {
  label: string;
}

const SLUG_RE = /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/;
const RESERVED = new Set(['id', 'status', 'createdAt', 'updatedAt', 'publishedAt']);

/** Validate and normalize a global definition. Throws on misconfiguration at startup. */
export function defineGlobal(config: GlobalConfig): ResolvedGlobal {
  if (!SLUG_RE.test(config.slug)) {
    throw new Error(
      `Invalid global slug "${config.slug}": use lowercase letters, numbers, - or _ (must start with a letter).`,
    );
  }
  if (config.fields.length === 0) {
    throw new Error(`Global "${config.slug}" must declare at least one field.`);
  }

  const seen = new Set<string>();
  for (const field of config.fields) {
    if (!field.name) throw new Error(`Global "${config.slug}" has a field with no name.`);
    if (RESERVED.has(field.name)) {
      throw new Error(`Global "${config.slug}" field "${field.name}" is reserved by the system.`);
    }
    if (seen.has(field.name)) {
      throw new Error(`Global "${config.slug}" has duplicate field "${field.name}".`);
    }
    seen.add(field.name);
    if (field.type === 'relation' && !field.relationTo) {
      throw new Error(`Global "${config.slug}" relation field "${field.name}" is missing "relationTo".`);
    }
    if (field.type === 'taxonomy' && !field.taxonomy) {
      throw new Error(`Global "${config.slug}" taxonomy field "${field.name}" is missing "taxonomy".`);
    }
    if (field.type === 'group' || field.type === 'repeater') {
      validateFieldList(field.fields, `Global "${config.slug}" > "${field.name}"`);
    }
  }

  return { ...config, label: config.label ?? humanize(config.slug) };
}

export function resolveGlobalAccess(access?: GlobalAccess): Required<GlobalAccess> {
  return {
    read: access?.read ?? anyone,
    update: access?.update ?? atLeast('editor'),
  };
}

/** Build a slug -> global lookup, guarding against duplicates. */
export function buildGlobalRegistry(globals: ResolvedGlobal[]): Map<string, ResolvedGlobal> {
  const registry = new Map<string, ResolvedGlobal>();
  for (const g of globals) {
    if (registry.has(g.slug)) throw new Error(`Duplicate global slug "${g.slug}".`);
    registry.set(g.slug, g);
  }
  return registry;
}
