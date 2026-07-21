import { describe, expect, it } from 'vitest';
import { defineCollection } from './collection.js';
import { buildSeo, fillUrlPattern, joinUrl, SEO_FIELD_NAMES } from './seo.js';
import type { Field } from './fields.js';

const baseFields: Field[] = [
  { name: 'title', type: 'text', required: true },
  { name: 'slug', type: 'slug', from: 'title' },
];

describe('defineCollection with seo', () => {
  it('injects SEO fields when enabled', () => {
    const c = defineCollection({ slug: 'posts', seo: true, fields: baseFields });
    for (const name of SEO_FIELD_NAMES) {
      expect(c.fields.some((f) => f.name === name)).toBe(true);
    }
    expect(c.seoConfig.enabled).toBe(true);
    expect(c.seoConfig.urlPattern).toBe('/:slug');
  });

  it('does not inject SEO fields when disabled', () => {
    const c = defineCollection({ slug: 'posts', fields: baseFields });
    expect(c.fields.some((f) => f.name === 'metaTitle')).toBe(false);
    expect(c.seoConfig.enabled).toBe(false);
  });

  it('honors a custom url pattern and user-declared overrides', () => {
    const c = defineCollection({
      slug: 'posts',
      seo: { urlPattern: '/blog/:slug' },
      fields: [...baseFields, { name: 'metaTitle', type: 'text', maxLength: 99 }],
    });
    expect(c.seoConfig.urlPattern).toBe('/blog/:slug');
    // The user's metaTitle should not be duplicated by the injected one.
    expect(c.fields.filter((f) => f.name === 'metaTitle')).toHaveLength(1);
    expect(c.fields.find((f) => f.name === 'metaTitle')).toMatchObject({ maxLength: 99 });
  });
});

describe('fillUrlPattern', () => {
  it('fills slug and collection tokens', () => {
    expect(fillUrlPattern('/:collection/:slug', { collection: 'posts', slug: 'hello' })).toBe(
      '/posts/hello',
    );
  });
  it('returns null when slug is required but missing', () => {
    expect(fillUrlPattern('/:slug', { collection: 'posts', slug: null })).toBeNull();
  });
});

describe('buildSeo', () => {
  it('falls back to the entry title and computes canonical from siteUrl', () => {
    const seo = buildSeo(
      { collection: 'posts', slug: 'hello', data: {} },
      { siteUrl: 'https://site.com', urlPattern: '/blog/:slug', fallbackTitle: 'Hello' },
    );
    expect(seo.title).toBe('Hello');
    expect(seo.canonical).toBe('https://site.com/blog/hello');
    expect(seo.noindex).toBe(false);
  });

  it('prefers explicit SEO values', () => {
    const seo = buildSeo(
      {
        collection: 'posts',
        slug: 'hello',
        data: {
          metaTitle: 'Custom',
          metaDescription: 'Desc',
          ogImage: 'https://img/x.png',
          canonicalUrl: 'https://canon/x',
          noindex: true,
        },
      },
      { siteUrl: 'https://site.com', fallbackTitle: 'Hello' },
    );
    expect(seo.title).toBe('Custom');
    expect(seo.description).toBe('Desc');
    expect(seo.image).toBe('https://img/x.png');
    expect(seo.canonical).toBe('https://canon/x');
    expect(seo.noindex).toBe(true);
  });
});

describe('joinUrl', () => {
  it('avoids double slashes', () => {
    expect(joinUrl('https://s.com/', '/a/b')).toBe('https://s.com/a/b');
  });
});
