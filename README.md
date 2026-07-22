<div align="center">

# FerroCMS

### The open-source, headless, Cloudflare-native CMS for JavaScript sites

A **WordPress alternative for developers** — a fast, type-safe, database-backed content platform
that runs on **Cloudflare's edge _or_ any Node host**. Model content in TypeScript, edit it in a clean
admin dashboard, and pull it into your **Next.js**, **Vue**, **Astro**, **SvelteKit**, or any-JS
front-end through an auto-generated, typed API.

[![CI](https://github.com/locateanup/FerroCMS/actions/workflows/ci.yml/badge.svg)](https://github.com/locateanup/FerroCMS/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6.svg)](https://www.typescriptlang.org/)
[![Built for Cloudflare](https://img.shields.io/badge/built%20for-Cloudflare-F38020.svg)](https://developers.cloudflare.com/workers/)

</div>

---

FerroCMS is an **open-source headless CMS** built for the modern JavaScript stack. Think WordPress-class
capability — content types, roles, a media library, a real database, SEO, and an extensible plugin
model — but **decoupled**, **edge-native**, and **type-safe** from the schema all the way to your
front-end. It's a developer-first alternative to WordPress, and a more complete alternative to
git-based tools like Keystatic, without the operational weight of a self-hosted Strapi/Directus.

> **Status:** 🚧 Early development. The core is implemented and tested (see [Features](#features)),
> but it's not yet production-ready. Stars and contributions are very welcome. ⭐

## Table of contents

- [Why FerroCMS](#why-ferrocms)
- [Features](#features)
- [How it compares](#how-it-compares)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [Deployment](#deployment)
- [SEO](#seo)
- [Consuming content in your site](#consuming-content-in-your-site)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

## Why FerroCMS

- **Headless & framework-agnostic** — your front-end stays yours. Next.js, Vue, Nuxt, Astro,
  SvelteKit, Remix, or plain fetch.
- **Cloudflare-native** — runs on Workers and R2, backed by libSQL (Turso). Global, cheap, and fast,
  with no servers to babysit.
- **Runs anywhere** — deploy to Cloudflare Workers _or_ Node (Docker / VPS / Render / Fly) from one
  codebase. Only a libSQL/Turso database is required.
- **Cost-effective** — designed to run on free tiers: Turso (libSQL) for data, R2 for media, Workers
  for compute.
- **Type-safe end to end** — one TypeScript content-type definition drives the database schema, runtime
  validation (Zod), the REST API, the admin form, and the client SDK's types.
- **Config as code** — version your content model in Git, review it in PRs, no clicking through admin
  screens to build a schema.
- **Open source (MIT)** — self-host it, fork it, extend it. No vendor lock-in.

## Features

Legend: ✅ implemented · 🚧 planned

### Content

- ✅ Custom content types / collections (like WordPress custom post types)
- ✅ Field types: text, textarea, number, boolean, date, select, JSON, slug, rich text, relation, media
- ✅ Block-based rich-text editor (paragraphs, headings, lists, quotes, code, images) — structured
  JSON, not raw HTML, so content can't inject arbitrary markup
- ✅ Draft / published / scheduled / archived states
- ✅ Automatic slug generation
- ✅ Revision history with one-click restore
- ✅ Taxonomies (`defineTaxonomy()`) — hierarchical or flat term lists (categories, tags) assigned via
  a `taxonomy` field, with a hierarchy-aware picker in the admin
- 🚧 i18n

### Delivery

- ✅ Auto-generated REST API per collection
- ✅ Typed client SDK (`@ferrocms/sdk`) for any JS front-end
- ✅ Public read / draft-protected access rules
- ✅ Webhooks on content changes (HMAC-signed) — on-publish revalidation for your site
- 🚧 GraphQL API, edge caching

### Admin

- ✅ Clean React admin dashboard (login, collection lists, generated editor, media library)
- ✅ Relation & media field pickers
- ✅ First-run admin setup
- 🚧 Live preview, drag-and-drop page builder, real-time collaboration

### Media

- ✅ Media library backed by Cloudflare R2 (upload, browse, delete, public serving)
- 🚧 Image transforms / responsive variants, folders, video

### Users & security

- ✅ Session auth with role-based access control (admin / editor / author / viewer)
- ✅ API keys, server-side authorization, Zod input validation, upload limits, CSRF-safe cookies
- 🚧 SSO / OAuth, 2FA, granular per-field permissions

### SEO

- ✅ Opt-in SEO fields per collection (meta title, description, social image, canonical, noindex)
- ✅ Generated `sitemap.xml` and `robots.txt`
- ✅ SDK helpers to render `<title>`, meta, Open Graph, Twitter, and canonical tags

### Extensibility

- ✅ Lifecycle hook engine (`beforeChange` / `afterChange`) — the seed of the plugin system
- 🚧 Plugin marketplace, custom field types, custom admin panels, integrations (GA4, ImageKit, Algolia, Stripe, …)

## How it compares

|                                    | FerroCMS |  WordPress  |   Keystatic    | Strapi / Directus |
| ---------------------------------- | :------: | :---------: | :------------: | :---------------: |
| Headless / bring-your-own-frontend |    ✅    | ⚠️ (add-on) |       ✅       |        ✅         |
| Runs on Cloudflare edge            |    ✅    |     ❌      |    ✅ (git)    |        ❌         |
| Database-backed content            |    ✅    |     ✅      | ❌ (git files) |        ✅         |
| TypeScript config as code          |    ✅    |     ❌      |       ✅       |        ⚠️         |
| Users, roles & media library       |    ✅    |     ✅      |   ⚠️ limited   |        ✅         |
| Type-safe client SDK               |    ✅    |     ❌      |       ⚠️       |        ⚠️         |
| Self-hosted & open source (MIT)    |    ✅    |     ✅      |       ✅       |        ✅         |

## Architecture

| Layer            | Tech                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------- |
| API / backend    | [Hono](https://hono.dev) on Cloudflare Workers                                            |
| Admin UI         | React + Vite SPA                                                                          |
| Database         | libSQL / SQLite ([Turso](https://turso.tech)) via [Drizzle ORM](https://orm.drizzle.team) |
| Media            | Cloudflare R2 (or filesystem on Node)                                                     |
| Sessions / cache | libSQL (`kv` table) — works on both runtimes                                              |
| Content model    | Config-as-code, TypeScript-first, validated with Zod                                      |

### Monorepo layout

```
apps/
  api/       Hono API — REST, auth, media, SEO, webhooks (Cloudflare Workers + Node entry points)
  admin/     React + Vite admin dashboard
packages/
  core/      content-type / field definitions, validation, SEO, hook engine
  db/        Drizzle schema + migrations
  sdk/       typed client for your front-end sites
```

## Quick start

**Prerequisites:** Node.js 20+, [pnpm](https://pnpm.io) 10+, and a free [Turso](https://turso.tech)
(libSQL) database. For local dev you can instead run `turso dev` (no account needed).

```bash
git clone https://github.com/locateanup/FerroCMS.git
cd FerroCMS
pnpm install

cp .env.example apps/api/.dev.vars     # add DATABASE_URL + DATABASE_AUTH_TOKEN + AUTH_SECRET
pnpm --filter @ferrocms/db db:push     # create tables on your Turso database

pnpm dev                               # runs the API worker + admin SPA
```

Open the admin at **http://localhost:5173** and register the first admin account.

## Deployment

Same codebase, two runtimes — pick whichever fits your infrastructure. **A libSQL/Turso database is
the only hard requirement**, and sessions live in it too (no separate KV service).

### Cloudflare (edge)

```bash
wrangler r2 bucket create ferrocms-media
wrangler secret put DATABASE_URL            # your Turso libsql:// URL
wrangler secret put DATABASE_AUTH_TOKEN
wrangler secret put AUTH_SECRET
pnpm --filter @ferrocms/api deploy          # → your Workers account
# deploy the admin (Vite build) to Cloudflare Pages
```

### Node (Docker / VPS / anywhere)

No Cloudflare account needed — uses filesystem storage; sessions/cache live in the database.

```bash
export DATABASE_URL="libsql://your-db.turso.io"
export DATABASE_AUTH_TOKEN="…"
export AUTH_SECRET="$(openssl rand -base64 32)"
export MEDIA_DIR="/var/lib/ferrocms/media"   # persist this volume
pnpm --filter @ferrocms/db db:push
pnpm --filter @ferrocms/api start:node       # serves the API on $PORT (default 8787)
```

The runtime is chosen by which entry point runs (`src/index.ts` for Workers, `src/node.ts` for Node);
platform differences (object storage, KV, background tasks) sit behind small adapters, so the API,
auth, media, SEO, and webhooks behave identically on both.

## SEO

Enable SEO on any collection and FerroCMS injects meta fields (meta title, meta description,
social image, canonical URL, noindex) and includes published entries in the sitemap:

```ts
defineCollection({
  slug: 'posts',
  seo: { urlPattern: '/blog/:slug' }, // or `seo: true` for the default `/:slug`
  fields: [/* ... */],
});
```

- `GET /sitemap.xml` — generated from published, non-`noindex` entries of SEO-enabled collections,
  using `SITE_URL` + each collection's `urlPattern`.
- `GET /robots.txt` — allows crawling and points at the sitemap.

## Consuming content in your site

Install the SDK in your front-end project and fetch typed content:

```ts
import { createClient, buildMeta, metaTags } from '@ferrocms/sdk';

const client = createClient({ url: 'https://cms.example.com' });

// List published posts
const { items } = await client.find('posts', { limit: 10 });

// Fetch one by slug and build SEO meta tags
const post = await client.findBySlug('posts', 'hello-world');
const meta = buildMeta(post, { siteUrl: 'https://mysite.com', urlPattern: '/blog/:slug' });
const tags = metaTags(meta); // -> [{ tag: 'title', text }, { tag: 'meta', attrs }, ...]
```

Rich text (`body` above) is a structured block array, not HTML — render it safely with:

```ts
import { renderRichTextHtml } from '@ferrocms/sdk';

const html = renderRichTextHtml(post.data.body, { mediaUrl: client.mediaUrl });
// -> '<p>Hello <strong>world</strong></p>...' — safe to insert as HTML
```

## FAQ

**Is FerroCMS production-ready?**
Not yet. The core (content types, RBAC, media, SEO, revisions, webhooks) is implemented and tested,
but the project is in early development. Try it, star it, and open issues — feedback shapes what comes
next.

**Do I have to use Cloudflare?**
No. FerroCMS is Cloudflare-first but **runs anywhere**. It ships two runtimes from the same codebase:
Cloudflare Workers (R2 for media) and **Node** (filesystem storage) for Docker, a VPS, Render, Fly, or
bare metal. libSQL (Turso) is the database on both, and sessions live in it — so all you ever need is a
libSQL database. See [Deployment](#deployment).

**How is this different from Payload, Strapi, or Directus?**
Same category (headless, code-first), but FerroCMS targets the **Cloudflare edge** specifically and
keeps a very small, type-safe core with everything else as opt-in. It's an early project, not a
drop-in replacement for those mature tools yet.

**What front-ends work with it?**
Anything that can call an HTTP API — Next.js, Vue/Nuxt, Astro, SvelteKit, Remix, or plain `fetch`.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). Please also read our
[Code of Conduct](./CODE_OF_CONDUCT.md) and [security policy](./SECURITY.md).

## License

[MIT](./LICENSE) © FerroCMS contributors

---

<div align="center">

**Keywords:** headless CMS · open source CMS · Cloudflare Workers CMS · Next.js CMS · Vue CMS ·
TypeScript CMS · serverless CMS · edge CMS · WordPress alternative · Keystatic alternative ·
Payload / Strapi / Directus alternative · Drizzle · Hono · R2 · Turso · libSQL

If FerroCMS looks useful, please ⭐ the repo — it genuinely helps others discover it.

</div>
