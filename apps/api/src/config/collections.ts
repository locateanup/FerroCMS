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

export const authors = defineCollection({
  slug: 'authors',
  drafts: false,
  admin: { icon: 'user', useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 120 },
    // Stable, human-readable id — referenced by a post's `author` field and
    // by the /authors/:slug page on the Next.js side, so it must stay
    // human-readable rather than the entry's opaque uuid.
    { name: 'slug', type: 'slug', from: 'name', unique: true },
    { name: 'role', type: 'text', maxLength: 120 },
    { name: 'bio', type: 'textarea', maxLength: 500 },
    {
      name: 'url',
      type: 'text',
      maxLength: 300,
      admin: { help: 'Link to their About page section or personal site.' },
    },
    { name: 'avatar', type: 'media' },
  ],
});

// Affiliate/referral partners — moneyinsider.co routes every affiliate link
// through /go/{slug} on the Next.js side, so the real destination URL lives
// here in one place instead of being hardcoded across articles.
export const affiliatePartners = defineCollection({
  slug: 'affiliate-partners',
  drafts: false,
  admin: { icon: 'link', useAsTitle: 'name' },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 120 },
    // Stable id used in /go/:slug and a post's sidebarPartner field — must
    // stay human-readable (e.g. "zerodha"), not the entry's opaque uuid.
    { name: 'slug', type: 'slug', from: 'name', unique: true },
    { name: 'url', type: 'text', required: true, maxLength: 500 },
    {
      name: 'network',
      type: 'text',
      maxLength: 120,
      admin: { help: 'e.g. direct, Impact, CJ Affiliate — for your own reporting.' },
    },
  ],
});

// Hierarchical taxonomy — categories can nest (e.g. Engineering > Backend).
export const categories = defineTaxonomy({ slug: 'categories' });

// Flat taxonomy — tags don't nest.
export const tags = defineTaxonomy({ slug: 'tags', hierarchical: false });

export const posts = defineCollection({
  slug: 'posts',
  seo: { urlPattern: '/blog/:slug' },
  admin: {
    icon: 'article',
    useAsTitle: 'title',
    defaultColumns: ['title', 'status'],
    previewUrlPattern: 'http://localhost:3000/preview/:collection/:id?token=:token',
  },
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
    // Conditional field: only shown (and only required) once "Featured" is checked.
    {
      name: 'featuredNote',
      type: 'text',
      maxLength: 200,
      required: true,
      admin: {
        condition: { field: 'featured', truthy: true },
        help: 'Shown once "Featured" is checked — why this post is featured.',
      },
    },
    // Repeater: a variable-length list of sub-fields, stored as an array.
    {
      name: 'relatedLinks',
      type: 'repeater',
      maxRows: 5,
      admin: { group: 'Related' },
      fields: [
        { name: 'label', type: 'text', required: true, maxLength: 80 },
        { name: 'url', type: 'text', required: true, maxLength: 500 },
      ],
    },
  ],
});

export const pages = defineCollection({
  slug: 'pages',
  seo: { urlPattern: '/:slug' },
  admin: {
    icon: 'file',
    useAsTitle: 'title',
    previewUrlPattern: 'http://localhost:3000/preview/:collection/:id?token=:token',
  },
  // i18n: body is translated per locale; title/slug stay single-locale (the
  // URL is the same page regardless of language in this demo). Arabic
  // demonstrates the RTL editor flip + translation-status indicators.
  locales: ['en', 'fr', 'ar'],
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

// Plugins can contribute collections and/or merge hooks into existing ones.
export const collections: ResolvedCollection[] = applyPlugins(
  [posts, pages, authors, affiliatePartners, categories, tags],
  [],
);

export const registry = buildRegistry(collections);

export function getCollection(slug: string): ResolvedCollection | undefined {
  return registry.get(slug);
}
