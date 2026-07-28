# Plugin authoring

FerroCMS's plugin system is built directly on the collection and hook engine — a plugin is a plain
object, not a separate runtime concept. There are four independent extension points, depending on
what you're extending: whole new collections, existing collections' lifecycle, custom field storage
types, custom field _widgets_, and custom admin pages.

## Backend plugins: `definePlugin`

A plugin can contribute new collections and/or merge hooks into collections it doesn't own — useful
for a package that adds e.g. a newsletter-subscribers collection, or attaches an analytics hook to
every write without editing every collection definition by hand:

```ts
import { definePlugin, defineCollection } from '@ferrocms/core';

export const analyticsPlugin = definePlugin({
  name: 'analytics',
  collections: [
    defineCollection({
      slug: 'analytics-events',
      fields: [{ name: 'name', type: 'text', required: true }],
    }),
  ],
  hooks: {
    posts: {
      afterChange: [({ doc }) => console.log('post changed', doc.id)],
    },
  },
});
```

Fold plugins into your base collection list at startup:

```ts
import { applyPlugins } from '@ferrocms/core';

export const collections = applyPlugins([posts, pages], [analyticsPlugin]);
```

`applyPlugins` throws at startup (not at request time) if a plugin's collection slug collides with an
existing one, or if its hooks target an unknown collection — misconfiguration fails loudly, immediately.

## Custom field storage types

The built-in `Field` union (`text`, `richText`, `relation`, ...) is closed and strongly typed. To add a
genuinely new storage/validation kind — not just a different widget — register it with
`registerFieldType()` and declare fields with `defineCustomField()`:

```ts
import { registerFieldType } from '@ferrocms/core';
import { z } from 'zod';

registerFieldType('geopoint', (field) =>
  z.object({ lat: z.number(), lng: z.number() }).nullable().optional(),
);
```

```ts
import { defineCustomField } from '@ferrocms/core';

defineCustomField({ name: 'location', type: 'geopoint', required: true });
```

`defineCustomField` is the one sanctioned place that casts past the closed `Field` union — a field
using an unregistered `type` fails loudly (`Unknown field type "..."`) rather than silently passing
validation.

## Custom admin widgets

Registering a storage type doesn't change how a field is _edited_ — for that, register a React
component against the field's `type` in the admin app:

```ts
// apps/admin/src/plugins.ts
import { registerFieldRenderer } from './lib/fieldRegistry.js';
import { GeopointInput } from './components/GeopointInput.js';

registerFieldRenderer('geopoint', GeopointInput);
```

This overrides the widget for every field of that `type`, everywhere in the admin — the same model
Payload/Strapi field-customization plugins use.

## Custom admin pages

Add whole new routes + sidebar entries to the admin (a system-status page, a custom reports view) via
`registerAdminPage()`:

```ts
// apps/admin/src/plugins.ts
import { registerAdminPage } from './lib/pageRegistry.js';
import { SystemStatusPage } from './pages/SystemStatusPage.js';

registerAdminPage({
  path: '/tools/status',
  label: 'System status',
  component: SystemStatusPage,
  minRole: 'admin', // optional — gates visibility/access by role
});
```

`apps/admin/src/plugins.ts` is imported for side effects from `main.tsx`, so every `registerX` call in
that file runs once at admin startup. This is the single file to edit when adding first-party or
third-party plugin registrations to your own fork.

## Third-party integrations

A few high-demand integrations ship as real, working code rather than just documented adapter shapes —
you still need your own account/instance for the hosted ones, but the FerroCMS-side wiring is done and
tested.

### Google Analytics (GA4)

`@ferrocms/sdk` exports a small client-side helper — no server component, since GA4 is a
browser-side pageview/event pipe:

```ts
import { gtagScriptTags, trackPageview, trackEvent } from '@ferrocms/sdk';

// In your site's <head> (Next.js: next/script, or render the tags directly):
for (const tag of gtagScriptTags('G-XXXXXXX')) {
  // tag.type is 'src' (the loader <script src>) or 'inline' (the gtag() config call)
}

// On route change / on a custom event:
trackPageview('/blog/hello-world');
trackEvent('newsletter_signup', { location: 'footer' });
```

`trackPageview`/`trackEvent` call `window.gtag` if the loader script ran, and no-op otherwise —
safe to call unconditionally, including during SSR.

### Meilisearch (site/full-text search)

The built-in `/api/search` endpoint (SQLite FTS5) needs zero setup and stays the default. If you run
your own [Meilisearch](https://www.meilisearch.com/docs/learn/getting_started/installation) instance
(self-hostable, open-source) and want its typo-tolerant ranked search instead, wire it via a plugin's
hooks rather than replacing the built-in route:

```ts
import { definePlugin } from '@ferrocms/core';
import { indexDocument, removeDocument } from '../lib/meilisearch.js';

const meiliConfig = { url: process.env.MEILISEARCH_URL!, apiKey: process.env.MEILISEARCH_API_KEY };

export const meilisearchPlugin = definePlugin({
  name: 'meilisearch-sync',
  hooks: {
    posts: {
      afterChange: [({ doc }) => indexDocument(meiliConfig, 'posts', { id: doc.id, ...doc.data })],
      afterDelete: [({ doc }) => removeDocument(meiliConfig, 'posts', doc.id)],
    },
  },
});
```

Set `MEILISEARCH_URL` (and `MEILISEARCH_API_KEY` if you enabled a master/API key) — see
`.env.example`. Query it from your front-end with `searchIndex(config, 'posts', query)`.

### Adapter pattern for other providers (Stripe, ImageKit, Algolia, …)

Payments (Stripe), alternate media CDNs (ImageKit, Cloudinary), and alternate search (Algolia) all
follow the same shape as `lib/meilisearch.ts`: a small typed function per operation, taking a config
object and calling the provider's real HTTP API directly — no SDK dependency, no abstraction beyond
what's needed. None of these three ship in FerroCMS core (they're paid, hosted services with no
self-hostable free tier to build and test against locally), but the pattern to add your own is:
create `apps/api/src/lib/<provider>.ts` following `meilisearch.ts`'s shape, then call it from a plugin
hook exactly like the example above — nothing in the request-handling core needs to change.

## Where to put plugin code

There's no separate plugin package format yet (no marketplace, no `npm install`-and-auto-discover) —
plugins are just TypeScript modules you import into `apps/api/src/config/collections.ts` (backend) and
`apps/admin/src/plugins.ts` (admin). A published npm package can still export a `FerroPlugin` object
and `registerX` calls for others to import the same way.
