/**
 * SEO support: a reusable set of fields collections can opt into, plus helpers
 * to normalize an entry's SEO data into the values a front-end needs to render
 * `<title>`, meta description, Open Graph / Twitter tags, canonical, and robots.
 */

import type { Field } from './fields.js';

export const SEO_GROUP = 'SEO';

/** Field names injected when a collection enables SEO. */
export const SEO_FIELD_NAMES = [
  'metaTitle',
  'metaDescription',
  'ogImage',
  'canonicalUrl',
  'noindex',
] as const;

export type SeoFieldName = (typeof SEO_FIELD_NAMES)[number];

/** The reusable SEO fields, spread into a collection when `seo` is enabled. */
export const seoFields: Field[] = [
  {
    name: 'metaTitle',
    type: 'text',
    label: 'Meta title',
    maxLength: 70,
    admin: { group: SEO_GROUP, help: 'Title tag. Falls back to the entry title (≈50–60 chars).' },
  },
  {
    name: 'metaDescription',
    type: 'textarea',
    label: 'Meta description',
    maxLength: 160,
    admin: { group: SEO_GROUP, help: 'Search snippet (≈150–160 chars).' },
  },
  {
    name: 'ogImage',
    type: 'text',
    label: 'Social image URL',
    admin: { group: SEO_GROUP, help: 'Absolute URL used for Open Graph / Twitter cards.' },
  },
  {
    name: 'canonicalUrl',
    type: 'text',
    label: 'Canonical URL',
    admin: { group: SEO_GROUP, help: 'Override the canonical link for this entry.' },
  },
  {
    name: 'noindex',
    type: 'boolean',
    label: 'Hide from search engines',
    admin: {
      group: SEO_GROUP,
      help: 'Adds noindex — the page will not be indexed or in the sitemap.',
    },
  },
];

/** Normalized SEO values ready for rendering meta tags. */
export interface ResolvedSeo {
  title?: string;
  description?: string;
  image?: string;
  canonical?: string;
  noindex: boolean;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/** Join a base URL and a path without double slashes. */
export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

/**
 * Fill a URL pattern (e.g. `/blog/:slug` or `/:collection/:slug`) from an entry.
 * Returns null if a required token can't be filled.
 */
export function fillUrlPattern(
  pattern: string,
  parts: { collection: string; slug: string | null },
): string | null {
  let missing = false;
  const path = pattern.replace(/:([a-zA-Z]+)/g, (_m, token: string) => {
    if (token === 'collection') return parts.collection;
    if (token === 'slug') {
      if (!parts.slug) missing = true;
      return parts.slug ?? '';
    }
    return '';
  });
  return missing ? null : path;
}

export interface BuildSeoOptions {
  /** Public base URL of the front-end site, for computing the canonical URL. */
  siteUrl?: string;
  /** URL pattern used to build the canonical when not explicitly set. */
  urlPattern?: string;
  /** Fallback title (usually the entry's title field). */
  fallbackTitle?: string;
}

/** Merge an entry's SEO fields with sensible fallbacks. */
export function buildSeo(
  entry: { collection?: string; slug: string | null; data: Record<string, unknown> },
  options: BuildSeoOptions = {},
): ResolvedSeo {
  const d = entry.data;
  let canonical = str(d.canonicalUrl);
  if (!canonical && options.siteUrl) {
    const path = fillUrlPattern(options.urlPattern ?? '/:slug', {
      collection: entry.collection ?? '',
      slug: entry.slug,
    });
    if (path !== null) canonical = joinUrl(options.siteUrl, path);
  }
  return {
    title: str(d.metaTitle) ?? options.fallbackTitle,
    description: str(d.metaDescription),
    image: str(d.ogImage),
    canonical,
    noindex: d.noindex === true,
  };
}
