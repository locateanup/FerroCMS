/**
 * A minimal plugin system built on the existing collection + hook engine.
 * A plugin can contribute whole new collections and/or merge lifecycle hooks
 * into existing ones — enough for a community package to add e.g. an
 * audit log, a comments collection, or an analytics integration without
 * forking core or editing every collection definition by hand.
 */

import type { CollectionHooks } from './hooks.js';
import type { ResolvedCollection } from './collection.js';

export interface FerroPlugin {
  /** Unique, human-readable name — used in error messages. */
  name: string;
  /** New collections this plugin adds (must not collide with existing slugs). */
  collections?: ResolvedCollection[];
  /** Hooks to merge into existing (or plugin-contributed) collections, keyed by slug. */
  hooks?: Record<string, CollectionHooks>;
}

/** Define a plugin. Purely an identity function — documents intent and gives editor autocomplete. */
export function definePlugin(plugin: FerroPlugin): FerroPlugin {
  return plugin;
}

function mergeHooks(a: CollectionHooks | undefined, b: CollectionHooks): CollectionHooks {
  return {
    beforeChange: [...(a?.beforeChange ?? []), ...(b.beforeChange ?? [])],
    afterChange: [...(a?.afterChange ?? []), ...(b.afterChange ?? [])],
    beforeDelete: [...(a?.beforeDelete ?? []), ...(b.beforeDelete ?? [])],
    afterDelete: [...(a?.afterDelete ?? []), ...(b.afterDelete ?? [])],
  };
}

/**
 * Fold a list of plugins into a base set of collections: adds each plugin's
 * new collections, then merges its hooks into whichever collection (base or
 * plugin-contributed) they target. Throws on slug collisions or hooks
 * referencing an unknown collection, so misconfiguration fails at startup.
 */
export function applyPlugins(
  collections: ResolvedCollection[],
  plugins: FerroPlugin[],
): ResolvedCollection[] {
  const bySlug = new Map(collections.map((c) => [c.slug, c]));

  for (const plugin of plugins) {
    for (const collection of plugin.collections ?? []) {
      if (bySlug.has(collection.slug)) {
        throw new Error(
          `Plugin "${plugin.name}" collection "${collection.slug}" collides with an existing collection.`,
        );
      }
      bySlug.set(collection.slug, collection);
    }
  }

  for (const plugin of plugins) {
    for (const [slug, hooks] of Object.entries(plugin.hooks ?? {})) {
      const target = bySlug.get(slug);
      if (!target) {
        throw new Error(`Plugin "${plugin.name}" targets unknown collection "${slug}".`);
      }
      bySlug.set(slug, { ...target, hooks: mergeHooks(target.hooks, hooks) });
    }
  }

  return Array.from(bySlug.values());
}
