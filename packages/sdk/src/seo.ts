/**
 * SEO helpers for front-end sites: turn a FerroCMS entry into normalized meta
 * values and ready-to-render meta-tag descriptors. Dependency-free.
 */

import type { FerroCmsEntry } from './index.js';

export interface SeoMeta {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  noindex: boolean;
}

export interface BuildMetaOptions {
  siteUrl?: string;
  /** Pattern for the canonical URL, e.g. `/blog/:slug` (default `/:slug`). */
  urlPattern?: string;
  /** Fallback title if the entry has no metaTitle (usually its title field). */
  fallbackTitle?: string;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function fillUrlPattern(pattern: string, collection: string, slug: string | null): string | null {
  let missing = false;
  const path = pattern.replace(/:([a-zA-Z]+)/g, (_m, token: string) => {
    if (token === 'collection') return collection;
    if (token === 'slug') {
      if (!slug) missing = true;
      return slug ?? '';
    }
    return '';
  });
  return missing ? null : path;
}

/** Merge an entry's SEO fields with fallbacks into renderable meta values. */
export function buildMeta(
  entry: Pick<FerroCmsEntry, 'collection' | 'slug' | 'data'>,
  options: BuildMetaOptions = {},
): SeoMeta {
  const d = entry.data as Record<string, unknown>;
  let canonical = str(d.canonicalUrl);
  if (!canonical && options.siteUrl) {
    const path = fillUrlPattern(options.urlPattern ?? '/:slug', entry.collection, entry.slug);
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

export interface MetaTag {
  tag: 'title' | 'meta' | 'link';
  attrs?: Record<string, string>;
  text?: string;
}

/**
 * Produce a list of meta-tag descriptors (title, description, Open Graph,
 * Twitter, canonical, robots). Render them however your framework prefers.
 */
export function metaTags(meta: SeoMeta): MetaTag[] {
  const tags: MetaTag[] = [];
  if (meta.title) {
    tags.push({ tag: 'title', text: meta.title });
    tags.push({ tag: 'meta', attrs: { property: 'og:title', content: meta.title } });
    tags.push({ tag: 'meta', attrs: { name: 'twitter:title', content: meta.title } });
  }
  if (meta.description) {
    tags.push({ tag: 'meta', attrs: { name: 'description', content: meta.description } });
    tags.push({ tag: 'meta', attrs: { property: 'og:description', content: meta.description } });
    tags.push({ tag: 'meta', attrs: { name: 'twitter:description', content: meta.description } });
  }
  if (meta.image) {
    tags.push({ tag: 'meta', attrs: { property: 'og:image', content: meta.image } });
    tags.push({ tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } });
  }
  if (meta.canonical) {
    tags.push({ tag: 'link', attrs: { rel: 'canonical', href: meta.canonical } });
  }
  if (meta.noindex) {
    tags.push({ tag: 'meta', attrs: { name: 'robots', content: 'noindex, nofollow' } });
  }
  return tags;
}
