/**
 * Content type ("collection") definitions — config as code.
 */

import { humanize, type Field } from './fields.js';
import type { CollectionAccess } from './access.js';
import type { CollectionHooks } from './hooks.js';
import { seoFields } from './seo.js';

export const ENTRY_STATUSES = ['draft', 'published', 'scheduled', 'archived'] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export interface CollectionAdminOptions {
  /** Field name used as the entry title in lists. Defaults to the first text field. */
  useAsTitle?: string;
  /** Columns to show in the list view. */
  defaultColumns?: string[];
  /** Sidebar grouping label. */
  group?: string;
  /** Tabler icon name for the sidebar. */
  icon?: string;
}

/** SEO options for a collection. `true` uses defaults. */
export type CollectionSeo = boolean | { urlPattern?: string };

/** Taxonomy options for a collection. `true` uses defaults (hierarchical). */
export type CollectionTaxonomy = boolean | { hierarchical?: boolean };

export interface CollectionConfig {
  /** URL + table key, e.g. 'posts'. Lowercase, kebab/snake, unique. */
  slug: string;
  labels?: { singular?: string; plural?: string };
  fields: Field[];
  /** Add createdAt/updatedAt. Default true. */
  timestamps?: boolean;
  /** Enable draft/published workflow. Default true. */
  drafts?: boolean;
  /**
   * Enable SEO: injects meta fields and includes published entries in the
   * sitemap. Pass `{ urlPattern }` to control how sitemap/canonical URLs are
   * built (default `/:slug`; supports `:collection` and `:slug` tokens).
   */
  seo?: CollectionSeo;
  /**
   * Mark this collection as a taxonomy (a term list other collections assign
   * via `taxonomy` fields — e.g. categories, tags). When hierarchical
   * (default), a self-referencing `parent` field is auto-injected unless
   * already declared. Prefer `defineTaxonomy()` over setting this directly.
   */
  taxonomy?: CollectionTaxonomy;
  /**
   * Locale codes this collection's `localized` fields are translated into,
   * e.g. `['en', 'fr']`. Required if any field sets `localized: true`.
   */
  locales?: string[];
  /** Default locale for fallback. Defaults to the first entry in `locales`. */
  defaultLocale?: string;
  access?: CollectionAccess;
  hooks?: CollectionHooks;
  admin?: CollectionAdminOptions;
}

/** A CollectionConfig with defaults resolved — what the runtime consumes. */
export interface ResolvedCollection extends CollectionConfig {
  timestamps: boolean;
  drafts: boolean;
  labels: { singular: string; plural: string };
  admin: CollectionAdminOptions & { useAsTitle: string };
  seoConfig: { enabled: boolean; urlPattern: string };
  taxonomyConfig: { enabled: boolean; hierarchical: boolean };
  locales: string[];
  defaultLocale?: string;
}

const SLUG_RE = /^[a-z][a-z0-9]*(?:[-_][a-z0-9]+)*$/;

/** Reserved field names that collide with system columns. */
const RESERVED = new Set(['id', 'status', 'createdAt', 'updatedAt', 'publishedAt']);

/**
 * Validate and normalize a collection definition. Throws on misconfiguration so
 * mistakes surface at startup, not at request time.
 */
export function defineCollection(config: CollectionConfig): ResolvedCollection {
  if (!SLUG_RE.test(config.slug)) {
    throw new Error(
      `Invalid collection slug "${config.slug}": use lowercase letters, numbers, - or _ (must start with a letter).`,
    );
  }

  if (config.fields.length === 0) {
    throw new Error(`Collection "${config.slug}" must declare at least one field.`);
  }

  // Resolve SEO and inject its fields (skipping any the user already declared).
  const seoEnabled = config.seo === true || (typeof config.seo === 'object' && config.seo !== null);
  const urlPattern = (typeof config.seo === 'object' && config.seo?.urlPattern) || '/:slug';
  const declaredNames = new Set(config.fields.map((f) => f.name));
  let fields: Field[] = seoEnabled
    ? [...config.fields, ...seoFields.filter((f) => !declaredNames.has(f.name))]
    : config.fields;

  // Resolve taxonomy: hierarchical taxonomies get a self-referencing `parent`
  // field unless the user already declared one.
  const taxonomyEnabled =
    config.taxonomy === true || (typeof config.taxonomy === 'object' && config.taxonomy !== null);
  const hierarchical =
    (typeof config.taxonomy === 'object' && config.taxonomy?.hierarchical) ?? true;
  if (taxonomyEnabled && hierarchical && !declaredNames.has('parent')) {
    fields = [
      ...fields,
      { name: 'parent', type: 'relation', relationTo: config.slug, label: 'Parent' },
    ];
  }

  const seen = new Set<string>();
  for (const field of fields) {
    if (!field.name) {
      throw new Error(`Collection "${config.slug}" has a field with no name.`);
    }
    if (RESERVED.has(field.name)) {
      throw new Error(
        `Collection "${config.slug}" field "${field.name}" is reserved by the system.`,
      );
    }
    if (seen.has(field.name)) {
      throw new Error(`Collection "${config.slug}" has duplicate field "${field.name}".`);
    }
    seen.add(field.name);
    if (field.type === 'relation' && !field.relationTo) {
      throw new Error(
        `Collection "${config.slug}" relation field "${field.name}" is missing "relationTo".`,
      );
    }
    if (field.type === 'taxonomy' && !field.taxonomy) {
      throw new Error(
        `Collection "${config.slug}" taxonomy field "${field.name}" is missing "taxonomy".`,
      );
    }
  }

  const locales = config.locales ?? [];
  const localizedFields = fields.filter((f) => f.localized === true);
  if (localizedFields.length > 0 && locales.length === 0) {
    throw new Error(
      `Collection "${config.slug}" has localized field(s) (${localizedFields
        .map((f) => f.name)
        .join(', ')}) but no "locales" configured.`,
    );
  }
  if (config.defaultLocale && !locales.includes(config.defaultLocale)) {
    throw new Error(
      `Collection "${config.slug}" defaultLocale "${config.defaultLocale}" is not in "locales".`,
    );
  }
  const defaultLocale = config.defaultLocale ?? locales[0];

  const firstText = config.fields.find((f) => f.type === 'text' || f.type === 'slug');
  const useAsTitle = config.admin?.useAsTitle ?? firstText?.name ?? config.fields[0]!.name;

  if (config.admin?.useAsTitle && !seen.has(config.admin.useAsTitle)) {
    throw new Error(
      `Collection "${config.slug}" admin.useAsTitle "${config.admin.useAsTitle}" is not a declared field.`,
    );
  }

  const singular = config.labels?.singular ?? humanize(config.slug).replace(/s$/, '');
  const plural = config.labels?.plural ?? humanize(config.slug);

  return {
    ...config,
    fields,
    timestamps: config.timestamps ?? true,
    drafts: config.drafts ?? true,
    labels: { singular, plural },
    admin: { ...config.admin, useAsTitle },
    seoConfig: { enabled: seoEnabled, urlPattern },
    taxonomyConfig: { enabled: taxonomyEnabled, hierarchical },
    locales,
    defaultLocale,
  };
}

/** Build a slug -> collection lookup, guarding against duplicates. */
export function buildRegistry(collections: ResolvedCollection[]): Map<string, ResolvedCollection> {
  const registry = new Map<string, ResolvedCollection>();
  for (const collection of collections) {
    if (registry.has(collection.slug)) {
      throw new Error(`Duplicate collection slug "${collection.slug}".`);
    }
    registry.set(collection.slug, collection);
  }
  return registry;
}
