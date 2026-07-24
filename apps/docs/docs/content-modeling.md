# Content modeling

FerroCMS content is **config-as-code**: you declare collections, fields, taxonomies, globals, and
forms as plain TypeScript objects. One definition drives the database shape, runtime validation, the
generated admin UI, and the REST/GraphQL API — there's no separate "schema migration" step for adding
or changing fields, because structured field data lives in a JSON `data` column with real columns only
for the hot, universal fields (`id`, `status`, `slug`, `createdAt`, `updatedAt`, `publishedAt`).

## Collections

```ts
import { defineCollection } from '@ferrocms/core';

export const posts = defineCollection({
  slug: 'posts',                 // URL + table key — lowercase, kebab/snake, unique
  labels: { singular: 'Post', plural: 'Posts' }, // optional, derived from slug otherwise
  timestamps: true,              // default true — adds createdAt/updatedAt
  drafts: true,                  // default true — draft/published/scheduled/archived
  seo: { urlPattern: '/blog/:slug' }, // optional — injects meta fields + sitemap entry
  locales: ['en', 'fr'],         // required if any field sets localized: true
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'slug', from: 'title', unique: true },
    { name: 'body', type: 'richText', localized: true },
  ],
  access: { read: () => true },  // optional — see Access control below
  admin: { useAsTitle: 'title', icon: 'article' },
});
```

`defineCollection` validates the config at startup (not at request time): duplicate field names,
missing `relationTo`/`taxonomy` targets, reserved field names (`id`, `status`, `createdAt`,
`updatedAt`, `publishedAt`), invalid slugs, and localized fields without a `locales` list all throw
immediately when your app boots.

## Field types

| Type | Notes |
|---|---|
| `text` / `textarea` | `minLength`, `maxLength`, `defaultValue` |
| `slug` | `from` auto-generates from another field (e.g. `title`) |
| `number` | `min`, `max`, `integer` |
| `boolean` | — |
| `date` | ISO 8601 string |
| `select` | `options: {label, value}[]`, `many` for multi-select |
| `json` | escape hatch for arbitrary structured data |
| `richText` | block-based rich text, stored as JSON, rendered safely via the SDK |
| `relation` | `relationTo` (target collection slug), `many` |
| `media` | references the media library, `many` |
| `taxonomy` | `taxonomy` (target taxonomy slug), `many` (default true) |
| `group` | `fields: Field[]` — a nested object, stored as `{ [name]: {...} }` |
| `repeater` | `fields: Field[]`, `minRows`/`maxRows` — an array of the same sub-fields |

Every field also supports: `required`, `unique`, `description`, `localized`, `access` (per-field
read/update, see below), and an `admin` block:

```ts
{
  name: 'featured',
  type: 'boolean',
  admin: {
    placeholder: '...',
    hidden: false,        // stored/returned but not shown in the form
    width: 'half',        // layout hint
    help: 'Shown on the homepage carousel.',
    group: 'Display',     // fields sharing a group render together
    condition: { field: 'status', equals: 'published' }, // see Conditional fields
  },
}
```

### Group and repeater fields

```ts
{
  name: 'seo',
  type: 'group',
  fields: [
    { name: 'title', type: 'text' },
    { name: 'description', type: 'textarea' },
  ],
}
```

```ts
{
  name: 'links',
  type: 'repeater',
  minRows: 0,
  maxRows: 5,
  fields: [
    { name: 'label', type: 'text', required: true },
    { name: 'url', type: 'text', required: true },
  ],
}
```

Both nest arbitrarily — a repeater can contain a group, a group can contain a repeater — and are
validated recursively (duplicate names, relation/taxonomy targets) the same way top-level fields are.

### Conditional fields

`admin.condition` is a **declarative** rule (`{ field, equals? | notEquals? | truthy? }`), not a
function — field schemas travel to the admin as JSON over `GET /api/collections`, so a closure
couldn't survive the trip. When the referenced sibling field's value doesn't satisfy the condition,
the admin hides the control and the value is not required.

## Taxonomies

A taxonomy is a reusable term list (categories, tags) other collections assign via a `taxonomy` field:

```ts
import { defineTaxonomy } from '@ferrocms/core';

export const categories = defineTaxonomy({
  slug: 'categories',
  hierarchical: true, // auto-injects a self-referencing `parent` field
});
```

```ts
{ name: 'category', type: 'taxonomy', taxonomy: 'categories' }
```

A taxonomy is really just a `ResolvedCollection` under the hood (`name`/`slug`/`description` fields
supplied for you, `drafts: false`), so it gets the same REST endpoint and admin list view — just
rendered as a term list instead of a content list.

## Globals

A global is a **single document** per slug — site settings, header/footer nav — not a list:

```ts
import { defineGlobal } from '@ferrocms/core';

export const siteSettings = defineGlobal({
  slug: 'site-settings',
  fields: [
    { name: 'siteName', type: 'text', required: true },
    { name: 'logo', type: 'media' },
  ],
});
```

Globals are deliberately not `ResolvedCollection`s: no drafts, no list view, no create/delete, just
`GET`/`PATCH` on the one document at `/api/globals/:slug`, so they never show up in the regular
`/api/:collection` CRUD routes.

## Forms

Forms collect public submissions (contact forms, signups) and reuse the exact same `Field[]` /
validation system as collections, but have no entries/drafts/access rules of their own — just a field
list and a stream of submissions:

```ts
import { defineForm } from '@ferrocms/core';

export const contactForm = defineForm({
  slug: 'contact',
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'email', type: 'text', required: true },
    { name: 'message', type: 'textarea', required: true },
  ],
});
```

Submit via `POST /api/forms/contact/submit` (rate-limited, public); view/moderate submissions via
`GET`/`DELETE /api/forms/contact/submissions` (editor+). See [API reference](/api-reference).

## Access control

Access functions receive `{ user, id? }` and return a boolean — always enforced **server-side**,
never trust the admin UI:

```ts
import { atLeast, anyone, authenticated } from '@ferrocms/core';

access: {
  read: anyone,             // public
  create: atLeast('author'),
  update: atLeast('author'),
  delete: atLeast('editor'),
}
```

Roles, ranked lowest to highest: `viewer < author < editor < admin`. Defaults (used when `access` is
omitted): anyone can read, authenticated authors+ can create/update, editors+ can delete.

Per-field access overrides the collection default for that one field — unreadable fields are stripped
from API responses, unwritable fields are stripped from incoming writes:

```ts
{ name: 'internalNote', type: 'text', access: { read: atLeast('editor'), update: atLeast('editor') } }
```

## Lifecycle hooks

`beforeChange` hooks can transform or reject data before a write; `afterChange`/`afterDelete` hooks run
side effects (this is what the built-in webhook dispatch, cache invalidation, and search indexing are
built on):

```ts
hooks: {
  beforeChange: [({ operation, data }) => ({ ...data, title: data.title.trim() })],
  afterChange: [({ doc }) => console.log('saved', doc.id)],
}
```

`beforeChange` hooks run in sequence, each receiving the previous hook's output — throw to reject the
write. See [Plugin authoring](/plugins) for how plugins contribute hooks to collections they don't own.
