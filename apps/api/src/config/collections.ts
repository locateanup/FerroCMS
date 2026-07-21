/**
 * Content type definitions for this FerroCMS instance.
 *
 * This is the "config as code" surface: add a collection here and the CRUD API,
 * validation, and (soon) admin forms are derived automatically. In a future
 * phase this moves to a user-editable config file.
 */

import { atLeast, buildRegistry, defineCollection, type ResolvedCollection } from '@ferrocms/core';

export const posts = defineCollection({
  slug: 'posts',
  seo: { urlPattern: '/blog/:slug' },
  admin: { icon: 'article', useAsTitle: 'title', defaultColumns: ['title', 'status'] },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 200 },
    { name: 'slug', type: 'slug', from: 'title', unique: true },
    { name: 'excerpt', type: 'textarea', maxLength: 300 },
    { name: 'body', type: 'richText' },
    {
      name: 'category',
      type: 'select',
      options: [
        { label: 'Engineering', value: 'engineering' },
        { label: 'Product', value: 'product' },
        { label: 'Company', value: 'company' },
      ],
    },
    { name: 'featured', type: 'boolean', defaultValue: false },
  ],
});

export const pages = defineCollection({
  slug: 'pages',
  seo: { urlPattern: '/:slug' },
  admin: { icon: 'file', useAsTitle: 'title' },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 200 },
    { name: 'slug', type: 'slug', from: 'title', unique: true, required: true },
    { name: 'body', type: 'richText' },
  ],
  access: {
    // Only editors and admins can manage pages.
    create: atLeast('editor'),
    update: atLeast('editor'),
    delete: atLeast('admin'),
  },
});

export const collections: ResolvedCollection[] = [posts, pages];

export const registry = buildRegistry(collections);

export function getCollection(slug: string): ResolvedCollection | undefined {
  return registry.get(slug);
}
