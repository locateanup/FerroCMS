import type { Context } from 'hono';
import { buildSeo, fillUrlPattern, joinUrl } from '@ferrocms/core';
import type { AppBindings } from '../env.js';
import { createDb } from '@ferrocms/db';
import { collections } from '../config/collections.js';
import { listEntries } from '../services/entries.js';

interface SitemapUrl {
  loc: string;
  lastmod?: string;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Build a urlset sitemap XML document from a list of URLs. */
export function buildSitemapXml(urls: SitemapUrl[]): string {
  const body = urls
    .map((u) => {
      const lastmod = u.lastmod ? `<lastmod>${escapeXml(u.lastmod)}</lastmod>` : '';
      return `  <url><loc>${escapeXml(u.loc)}</loc>${lastmod}</url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function siteUrl(c: Context<AppBindings>): string {
  return (c.env.SITE_URL ?? c.env.ADMIN_ORIGIN).replace(/\/+$/, '');
}

/** GET /sitemap.xml — published entries from SEO-enabled collections. */
export async function sitemapHandler(c: Context<AppBindings>): Promise<Response> {
  const db = createDb(c.env.DATABASE_URL);
  const base = siteUrl(c);
  const urls: SitemapUrl[] = [];

  for (const collection of collections) {
    if (!collection.seoConfig.enabled) continue;
    const { items } = await listEntries(db, {
      collection: collection.slug,
      publishedOnly: true,
      limit: 5000,
      offset: 0,
    });
    for (const entry of items) {
      if ((entry.data as Record<string, unknown>).noindex === true) continue;
      const path = fillUrlPattern(collection.seoConfig.urlPattern, {
        collection: collection.slug,
        slug: entry.slug,
      });
      if (path === null) continue;
      urls.push({ loc: joinUrl(base, path), lastmod: entry.updatedAt.toISOString() });
    }
  }

  return c.body(buildSitemapXml(urls), 200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600',
  });
}

/** GET /robots.txt — allow crawling and point at the sitemap. */
export function robotsHandler(c: Context<AppBindings>): Response {
  const base = siteUrl(c);
  const body = `User-agent: *\nAllow: /\n\nSitemap: ${joinUrl(base, '/sitemap.xml')}\n`;
  return c.body(body, 200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'public, max-age=86400',
  });
}

// Re-export for tests / consumers that want the SEO builder.
export { buildSeo };
