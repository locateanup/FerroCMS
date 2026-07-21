import { describe, expect, it } from 'vitest';
import app from '../index.js';
import { buildSitemapXml } from './seo.js';

const env = {
  ADMIN_ORIGIN: 'http://localhost:5173',
  SITE_URL: 'https://mysite.com',
  DATABASE_URL: 'http://127.0.0.1:8080',
  AUTH_SECRET: 'test-secret',
  MEDIA: {} as never,
};

describe('buildSitemapXml', () => {
  it('builds a valid urlset and escapes special characters', () => {
    const xml = buildSitemapXml([
      { loc: 'https://mysite.com/blog/a', lastmod: '2026-01-01T00:00:00.000Z' },
      { loc: 'https://mysite.com/x?y=1&z=2' },
    ]);
    expect(xml).toContain('<urlset');
    expect(xml).toContain('<loc>https://mysite.com/blog/a</loc>');
    expect(xml).toContain('<lastmod>2026-01-01T00:00:00.000Z</lastmod>');
    expect(xml).toContain('&amp;'); // ampersand escaped
    expect(xml.trim().endsWith('</urlset>')).toBe(true);
  });
});

describe('robots.txt', () => {
  it('allows crawling and points at the sitemap', async () => {
    const res = await app.request('/robots.txt', {}, env);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain('User-agent: *');
    expect(body).toContain('Sitemap: https://mysite.com/sitemap.xml');
  });
});
