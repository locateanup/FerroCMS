/**
 * Global (singleton) definitions — see packages/core/src/global.ts. Unlike
 * collections these aren't listed here for pagination/CRUD; there's exactly
 * one document per slug, reachable only via /api/globals/:slug.
 */

import { defineGlobal, buildGlobalRegistry, type ResolvedGlobal } from '@ferrocms/core';

export const siteSettings = defineGlobal({
  slug: 'site-settings',
  label: 'Site Settings',
  fields: [
    { name: 'siteName', type: 'text', required: true, maxLength: 120 },
    { name: 'tagline', type: 'text', maxLength: 200 },
    { name: 'logo', type: 'media' },
    { name: 'footerText', type: 'textarea', maxLength: 500 },
  ],
});

export const globals: ResolvedGlobal[] = [siteSettings];

export const globalRegistry = buildGlobalRegistry(globals);

export function getGlobal(slug: string): ResolvedGlobal | undefined {
  return globalRegistry.get(slug);
}
