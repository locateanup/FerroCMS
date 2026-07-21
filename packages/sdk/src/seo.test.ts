import { describe, expect, it } from 'vitest';
import { buildMeta, metaTags } from './seo.js';
import type { FerroCmsEntry } from './index.js';

const entry: Pick<FerroCmsEntry, 'collection' | 'slug' | 'data'> = {
  collection: 'posts',
  slug: 'hello-world',
  data: { title: 'Hello World', metaDescription: 'A greeting.' },
};

describe('buildMeta', () => {
  it('computes canonical from siteUrl + pattern and uses fallback title', () => {
    const meta = buildMeta(entry, {
      siteUrl: 'https://site.com',
      urlPattern: '/blog/:slug',
      fallbackTitle: 'Hello World',
    });
    expect(meta.title).toBe('Hello World');
    expect(meta.description).toBe('A greeting.');
    expect(meta.canonical).toBe('https://site.com/blog/hello-world');
    expect(meta.noindex).toBe(false);
  });

  it('prefers an explicit canonical and metaTitle', () => {
    const meta = buildMeta(
      {
        collection: 'posts',
        slug: 'x',
        data: { metaTitle: 'Custom', canonicalUrl: 'https://c/x' },
      },
      { siteUrl: 'https://site.com' },
    );
    expect(meta.title).toBe('Custom');
    expect(meta.canonical).toBe('https://c/x');
  });
});

describe('metaTags', () => {
  it('produces title, description, OG, and canonical tags', () => {
    const tags = metaTags({
      title: 'Hello',
      description: 'Desc',
      image: 'https://img/x.png',
      canonical: 'https://site.com/blog/hello',
      noindex: false,
    });
    expect(tags.some((t) => t.tag === 'title' && t.text === 'Hello')).toBe(true);
    expect(tags.some((t) => t.attrs?.property === 'og:image')).toBe(true);
    expect(tags.some((t) => t.tag === 'link' && t.attrs?.rel === 'canonical')).toBe(true);
    expect(tags.some((t) => t.attrs?.name === 'robots')).toBe(false);
  });

  it('adds a robots noindex tag when noindex is set', () => {
    const tags = metaTags({ noindex: true });
    expect(tags.some((t) => t.attrs?.content === 'noindex, nofollow')).toBe(true);
  });
});
