/**
 * Content type definitions for this FerroCMS instance.
 *
 * This is the "config as code" surface: add a collection here and the CRUD API,
 * validation, and (soon) admin forms are derived automatically. In a future
 * phase this moves to a user-editable config file.
 */

import {
  applyPlugins,
  atLeast,
  buildRegistry,
  defineCollection,
  defineTaxonomy,
  type ResolvedCollection,
} from '@ferrocms/core';
import { auditLogPlugin } from '../plugins/auditLog.js';

export const authors = defineCollection({
  slug: 'authors',
  drafts: false,
  admin: { icon: 'user', useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 120 },
    { name: 'bio', type: 'textarea', maxLength: 500 },
    { name: 'avatar', type: 'media' },
  ],
});

// Hierarchical taxonomy — categories can nest (e.g. Engineering > Backend).
export const categories = defineTaxonomy({ slug: 'categories' });

// Flat taxonomy — tags don't nest.
export const tags = defineTaxonomy({ slug: 'tags', hierarchical: false });

export const posts = defineCollection({
  slug: 'posts',
  seo: { urlPattern: '/blog/:slug' },
  admin: { icon: 'article', useAsTitle: 'title', defaultColumns: ['title', 'status'] },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 200 },
    { name: 'slug', type: 'slug', from: 'title', unique: true },
    { name: 'excerpt', type: 'textarea', maxLength: 300 },
    { name: 'coverImage', type: 'media' },
    { name: 'author', type: 'relation', relationTo: 'authors' },
    { name: 'body', type: 'richText' },
    { name: 'categories', type: 'taxonomy', taxonomy: 'categories' },
    { name: 'tags', type: 'taxonomy', taxonomy: 'tags' },
    // Field-level permission: any author can create/edit a post, but only
    // editors+ may toggle whether it's featured on the homepage.
    {
      name: 'featured',
      type: 'boolean',
      defaultValue: false,
      access: { update: atLeast('editor') },
    },
  ],
});

export const pages = defineCollection({
  slug: 'pages',
  seo: { urlPattern: '/:slug' },
  admin: { icon: 'file', useAsTitle: 'title' },
  // i18n: body is translated per locale; title/slug stay single-locale (the
  // URL is the same page regardless of language in this demo).
  locales: ['en', 'fr'],
  defaultLocale: 'en',
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 200 },
    { name: 'slug', type: 'slug', from: 'title', unique: true, required: true },
    { name: 'body', type: 'richText', localized: true },
  ],
  access: {
    // Only editors and admins can manage pages.
    create: atLeast('editor'),
    update: atLeast('editor'),
    delete: atLeast('admin'),
  },
});

// Plugins can contribute collections and/or merge hooks into existing ones —
// see plugins/auditLog.ts for a minimal example.
export const collections: ResolvedCollection[] = applyPlugins(
  [posts, pages, authors, categories, tags],
  [auditLogPlugin],
);

export const registry = buildRegistry(collections);

export function getCollection(slug: string): ResolvedCollection | undefined {
  return registry.get(slug);
}
