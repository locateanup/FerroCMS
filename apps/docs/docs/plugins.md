# Plugin authoring

FerroCMS's plugin system is built directly on the collection and hook engine — a plugin is a plain
object, not a separate runtime concept. There are four independent extension points, depending on
what you're extending: whole new collections, existing collections' lifecycle, custom field storage
types, custom field *widgets*, and custom admin pages.

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

Registering a storage type doesn't change how a field is *edited* — for that, register a React
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

## Where to put plugin code

There's no separate plugin package format yet (no marketplace, no `npm install`-and-auto-discover) —
plugins are just TypeScript modules you import into `apps/api/src/config/collections.ts` (backend) and
`apps/admin/src/plugins.ts` (admin). A published npm package can still export a `FerroPlugin` object
and `registerX` calls for others to import the same way.
