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
    { name: 'description', type: 'textarea', maxLength: 300 },
    { name: 'logo', type: 'media' },
    {
      name: 'social',
      type: 'group',
      fields: [
        { name: 'youtube', type: 'text', maxLength: 300 },
        { name: 'x', type: 'text', maxLength: 300 },
      ],
    },
    // Default site-wide byline (E-E-A-T) — used when a post has no author set.
    {
      name: 'author',
      type: 'group',
      admin: { help: 'Byline / E-E-A-T — used when a post has no author set.' },
      fields: [
        { name: 'name', type: 'text', maxLength: 120 },
        { name: 'role', type: 'text', maxLength: 120 },
        { name: 'bio', type: 'textarea', maxLength: 500 },
        { name: 'url', type: 'text', maxLength: 300 },
      ],
    },
    {
      name: 'newsletter',
      type: 'group',
      admin: { group: 'Newsletter box' },
      fields: [
        { name: 'heading', type: 'text', maxLength: 200 },
        { name: 'subtext', type: 'text', maxLength: 300 },
      ],
    },
    // Rates/indices strip above the site masthead. Deliberately editorial
    // rather than a live market feed — a flaky third-party quote API at the
    // very top of every page is a worse trade than a number an editor
    // refreshes on purpose. An empty list hides the strip entirely.
    {
      name: 'ticker',
      type: 'repeater',
      admin: {
        group: 'Ticker bar',
        help: 'Shown above the masthead. Leave empty to hide the strip.',
      },
      fields: [
        { name: 'label', type: 'text', required: true, maxLength: 40 },
        { name: 'value', type: 'text', required: true, maxLength: 40 },
        {
          name: 'trend',
          type: 'select',
          defaultValue: 'flat',
          options: [
            { label: 'No arrow', value: 'flat' },
            { label: 'Up', value: 'up' },
            { label: 'Down', value: 'down' },
          ],
        },
      ],
    },
    // Editor-curated sidebar list. Stored as plain "{pillar}/{slug}" URL
    // paths rather than relations to `posts`: the consuming site looks these
    // up by path, and a path keeps working if the entry is rebuilt, while a
    // relation id would not.
    {
      name: 'popularPosts',
      type: 'repeater',
      admin: {
        group: 'Sidebar',
        help: 'Shown in every article\'s sidebar. Each entry is "{pillar}/{slug}", matching the article\'s URL path.',
      },
      fields: [{ name: 'path', type: 'text', required: true, maxLength: 200 }],
    },
    // Controls which article-sidebar widgets render and in what order — list
    // order IS render order (drag rows to reorder in the admin).
    {
      name: 'sidebarWidgets',
      type: 'repeater',
      admin: { group: 'Sidebar', help: 'Drag rows to reorder. Untick to hide a widget.' },
      fields: [
        {
          name: 'widget',
          type: 'select',
          required: true,
          options: [
            { label: 'Table of contents', value: 'toc' },
            { label: 'Featured affiliate offer', value: 'offer' },
            { label: 'Author card', value: 'author' },
            { label: "Editor's picks", value: 'popular' },
            { label: 'Newsletter signup', value: 'newsletter' },
          ],
        },
        { name: 'enabled', type: 'boolean', defaultValue: true },
      ],
    },
  ],
});

export const globals: ResolvedGlobal[] = [siteSettings];

export const globalRegistry = buildGlobalRegistry(globals);

export function getGlobal(slug: string): ResolvedGlobal | undefined {
  return globalRegistry.get(slug);
}
