/**
 * Taxonomies — reusable term lists (categories, tags, ...) that other
 * collections assign via `taxonomy` fields. Built on `defineCollection`, with
 * the standard name/slug/description fields (and a `parent` self-relation
 * when hierarchical) supplied for you.
 */

import type { CollectionAccess } from './access.js';
import { defineCollection, type ResolvedCollection } from './collection.js';
import type { CollectionAdminOptions } from './collection.js';
import type { CollectionHooks } from './hooks.js';
import type { Field } from './fields.js';

export interface TaxonomyConfig {
  /** URL + table key, e.g. 'categories'. */
  slug: string;
  labels?: { singular?: string; plural?: string };
  /** Auto-inject a self-referencing `parent` field for nested terms. Default true. */
  hierarchical?: boolean;
  /** Additional fields beyond name/slug/description. */
  extraFields?: Field[];
  access?: CollectionAccess;
  hooks?: CollectionHooks;
  admin?: CollectionAdminOptions;
}

/**
 * Define a taxonomy as a `ResolvedCollection` — usable anywhere a collection
 * is (listed in the admin, has a REST endpoint), but flagged via
 * `taxonomyConfig` so the admin renders it as a term list.
 */
export function defineTaxonomy(config: TaxonomyConfig): ResolvedCollection {
  const fields: Field[] = [
    { name: 'name', type: 'text', required: true, maxLength: 100 },
    { name: 'slug', type: 'slug', from: 'name', unique: true },
    { name: 'description', type: 'textarea', maxLength: 300 },
    ...(config.extraFields ?? []),
  ];

  return defineCollection({
    slug: config.slug,
    labels: config.labels,
    fields,
    drafts: false,
    timestamps: true,
    taxonomy: { hierarchical: config.hierarchical ?? true },
    access: config.access,
    hooks: config.hooks,
    admin: { icon: 'tag', useAsTitle: 'name', ...config.admin },
  });
}
