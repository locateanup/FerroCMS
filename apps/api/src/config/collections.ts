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

// Flat taxonomy — tags don't nest. (No "categories" taxonomy — moneyinsider's
// content pillars are a fixed 5-value select on the post itself, not an
// open-ended taxonomy.)
export const tags = defineTaxonomy({ slug: 'tags', hierarchical: false });

export const posts = defineCollection({
  slug: 'posts',
  // moneyinsider.co's real URL is /{pillar}/{slug} — fillUrlPattern only
  // substitutes :collection/:slug, not arbitrary entry fields, so this
  // pattern is informational only. The Next.js site builds its own
  // canonical/sitemap URLs from the `pillar` field and never reads
  // FerroCMS's own canonicalUrl/sitemap output for posts.
  seo: true,
  admin: {
    icon: 'article',
    useAsTitle: 'title',
    defaultColumns: ['title', 'pillar', 'status'],
    previewUrlPattern: 'http://localhost:3000/preview/:collection/:id?token=:token',
  },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 200 },
    { name: 'slug', type: 'slug', from: 'title', unique: true },
    { name: 'description', type: 'textarea', required: true, maxLength: 300 },
    {
      name: 'pillar',
      type: 'select',
      required: true,
      options: [
        { label: 'First job & paycheck basics', value: 'first-job' },
        { label: 'Building credit & banking', value: 'building-credit' },
        { label: 'Student loans & debt payoff', value: 'student-loans' },
        { label: 'Budgeting & saving', value: 'budgeting' },
        { label: 'Starter investing', value: 'investing' },
      ],
    },
    // No custom publishedAt field — every entry already has a system
    // publishedAt (set when status becomes "published"), which is what
    // Next.js reads as the article's publish date.
    {
      name: 'revisedAt',
      type: 'date',
      admin: {
        help: "Bump this whenever you meaningfully revise the guide — unlike the system's updatedAt (which changes on every save, including drafts), this is a deliberate freshness signal shown in the byline.",
      },
    },
    { name: 'author', type: 'relation', relationTo: 'authors' },
    {
      name: 'country',
      type: 'select',
      options: [{ label: 'India', value: 'IN' }],
    },
    {
      name: 'youtube',
      type: 'text',
      admin: { help: 'Just the video ID from the URL, e.g. dQw4w9WgXcQ' },
    },
    { name: 'cover', type: 'media' },
    { name: 'tags', type: 'taxonomy', taxonomy: 'tags' },
    { name: 'featured', type: 'boolean', defaultValue: false },
    {
      name: 'sidebarPartner',
      type: 'relation',
      relationTo: 'affiliate-partners',
      admin: {
        group: 'Sidebar',
        help: 'Highlights this partner in the article sidebar.',
      },
    },
    {
      name: 'faq',
      type: 'repeater',
      admin: { help: 'Adds an FAQ section + FAQPage schema at the end of the article.' },
      fields: [
        { name: 'question', type: 'text', required: true, maxLength: 200 },
        { name: 'answer', type: 'textarea', required: true, maxLength: 500 },
      ],
    },
    { name: 'body', type: 'richText' },
  ],
});

export const pages = defineCollection({
  slug: 'pages',
  seo: true,
  admin: {
    icon: 'file',
    useAsTitle: 'title',
    previewUrlPattern: 'http://localhost:3000/preview/:collection/:id?token=:token',
  },
  fields: [
    { name: 'title', type: 'text', required: true, maxLength: 200 },
    { name: 'slug', type: 'slug', from: 'title', unique: true, required: true },
    { name: 'description', type: 'textarea', required: true, maxLength: 300 },
    {
      name: 'revisedAt',
      type: 'date',
      admin: { help: 'Bump this whenever you meaningfully revise the page.' },
    },
    { name: 'body', type: 'richText' },
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
  [posts, pages, authors, affiliatePartners, tags],
  [],
);

export const registry = buildRegistry(collections);

export function getCollection(slug: string): ResolvedCollection | undefined {
  return registry.get(slug);
}
