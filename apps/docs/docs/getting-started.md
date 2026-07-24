# Getting started

**Prerequisites:** Node.js 20+, [pnpm](https://pnpm.io) 10+, and a free [Turso](https://turso.tech)
(libSQL) database. For local dev you can instead run `turso dev` (no account needed) — no Cloudflare
account is required to try FerroCMS locally.

## Clone and install

```bash
git clone https://github.com/locateanup/FerroCMS.git
cd FerroCMS
pnpm install
```

## Configure

```bash
cp .env.example apps/api/.dev.vars
```

Fill in `DATABASE_URL` and `DATABASE_AUTH_TOKEN` (from Turso, or `turso dev`'s local URL) and a random
`AUTH_SECRET` (e.g. `openssl rand -base64 32`).

## Create the database tables

```bash
pnpm --filter @ferrocms/db db:push
```

This pushes the Drizzle schema (users, collections' `entries`, media, sessions, revisions, audit log,
comments, form submissions, ...) to your libSQL database. It's safe to re-run.

## Run it

```bash
pnpm dev
```

This boots the API worker (`apps/api`, default `http://localhost:8787`) and the admin SPA
(`apps/admin`, default `http://localhost:5173`) together via Turborepo.

Open **`http://localhost:5173`** and register the first account — the first user to register becomes
an `admin`.

## Define your first collection

Collections are config-as-code, not something you click together in the admin. Edit
`apps/api/src/config/collections.ts` (or add a new file and import it there):

```ts
import { defineCollection } from '@ferrocms/core';

export const posts = defineCollection({
  slug: 'posts',
  seo: { urlPattern: '/blog/:slug' },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'slug', from: 'title', unique: true },
    { name: 'body', type: 'richText' },
  ],
});
```

Add it to the exported `collections` array, restart `pnpm dev`, and it immediately appears in the admin
sidebar with a generated list view and edit form — no migration step, because structured field data
lives in a JSON column. See [Content modeling](/content-modeling) for the full field system.

## Next steps

- [Content modeling](/content-modeling) — fields, taxonomies, globals, forms, access control.
- [API reference](/api-reference) — REST/GraphQL endpoints and the client SDK.
- [Deployment](/deployment) — ship to Cloudflare Workers or plain Node.
- [Plugin authoring](/plugins) — extend the admin and the backend.
