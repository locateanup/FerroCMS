<div align="center">

# FerroCMS

### The open-source, headless, Cloudflare-native CMS for JavaScript sites

A **WordPress alternative for developers** — a fast, type-safe, database-backed content platform
that runs entirely on **Cloudflare's edge**. Model content in TypeScript, edit it in a clean admin
dashboard, and pull it into your **Next.js**, **Vue**, **Astro**, **SvelteKit**, or any-JS front-end
through an auto-generated, typed API.

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

> **Status:** 🚧 Early development. Phase 1 (MVP core) + SEO are implemented and tested; the rest of
> the roadmap is in progress. Not yet production-ready — see the [Roadmap](#roadmap). Stars and
> contributions are very welcome. ⭐

## Table of contents

- [Why FerroCMS](#why-ferrocms)
- [Features](#features)
- [How it compares](#how-it-compares)
- [Architecture](#architecture)
- [Quick start](#quick-start)
- [SEO](#seo)
- [Consuming content in your site](#consuming-content-in-your-site)
- [Roadmap](#roadmap)
- [FAQ](#faq)
- [Contributing](#contributing)
- [License](#license)

## Why FerroCMS

- **Headless & framework-agnostic** — your front-end stays yours. Next.js, Vue, Nuxt, Astro,
  SvelteKit, Remix, or plain fetch.
- **Cloudflare-native** — runs on Workers, R2, KV, and Queues, backed by serverless Postgres. Global,
  cheap, and fast, with no servers to babysit.
- **Type-safe end to end** — one TypeScript content-type definition drives the database schema, runtime
  validation (Zod), the REST API, the admin form, and the client SDK's types.
- **Config as code** — version your content model in Git, review it in PRs, no clicking through admin
  screens to build a schema.
- **Open source (MIT)** — self-host it, fork it, extend it. No vendor lock-in.

## Features

Legend: ✅ implemented · 🚧 on the roadmap

### Content

- ✅ Custom content types / collections (like WordPress custom post types)
- ✅ Field types: text, textarea, number, boolean, date, select, JSON, slug, rich text, relation, media
- ✅ Draft / published / scheduled / archived states
- ✅ Automatic slug generation
- ✅ Revision history with one-click restore
- 🚧 Block-based rich-text editor, taxonomies, i18n

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

| Layer            | Tech                                                                     |
| ---------------- | ------------------------------------------------------------------------ |
| API / backend    | [Hono](https://hono.dev) on Cloudflare Workers                           |
| Admin UI         | React + Vite SPA                                                         |
| Database         | PostgreSQL (Neon serverless) via [Drizzle ORM](https://orm.drizzle.team) |
| Media            | Cloudflare R2                                                            |
| Sessions / cache | Workers KV                                                               |
| Background jobs  | Cloudflare Queues                                                        |
| Content model    | Config-as-code, TypeScript-first, validated with Zod                     |

### Monorepo layout

```
apps/
  api/       Hono Worker — REST API, auth, media, SEO, webhooks
  admin/     React + Vite admin dashboard
packages/
  core/      content-type / field definitions, validation, SEO, hook engine
  db/        Drizzle schema + migrations
  sdk/       typed client for your front-end sites
```

## Quick start

**Prerequisites:** Node.js 20+, [pnpm](https://pnpm.io) 10+, a free [Neon](https://neon.tech) Postgres
database, and a [Cloudflare](https://dash.cloudflare.com) account (for R2 + KV).

```bash
git clone https://github.com/locateanup/FerroCMS.git
cd FerroCMS
pnpm install

cp .env.example apps/api/.dev.vars     # add DATABASE_URL + AUTH_SECRET
pnpm --filter @ferrocms/db db:push     # create tables on your Neon database

pnpm dev                               # runs the API worker + admin SPA
```

Open the admin at **http://localhost:5173** and register the first admin account.

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

## Roadmap

- **Phase 1 — MVP core** ✅ content types, fields, RBAC, media library, draft/publish, auto REST API
- **Phase 2 — Production-real** 🚧 block editor, relations, taxonomies, revisions UI, **SEO** ✅, i18n, SDK ✅, webhooks
- **Phase 3 — Extensibility** 🚧 plugin/hook system, GraphQL, SSO, search, backups
- **Phase 4 — Ecosystem** 🚧 page builder, real-time collab, comments, forms, e-commerce, AI, integrations, marketplace

## FAQ

**Is FerroCMS production-ready?**
Not yet. Phase 1 + SEO are implemented and tested, but the project is in early development. Try it,
star it, and follow along — feedback shapes the roadmap.

**Do I have to use Cloudflare?**
It's designed Cloudflare-first (Workers, R2, KV) with Neon Postgres. Other runtimes aren't a supported
target today, but the core (`@ferrocms/core`) and SDK are runtime-agnostic TypeScript.

**How is this different from Payload, Strapi, or Directus?**
Same category (headless, code-first), but FerroCMS targets the **Cloudflare edge** specifically and
keeps a very small, type-safe core with everything else as opt-in. It's an early project, not a
drop-in replacement for those mature tools yet.

**What front-ends work with it?**
Anything that can call an HTTP API — Next.js, Vue/Nuxt, Astro, SvelteKit, Remix, or plain `fetch`.

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). Please also read our
[Code of Conduct](./CODE_OF_CONDUCT.md) and [security policy](./SECURITY.md). Good first issues and a
detailed roadmap are on the way.

## License

[MIT](./LICENSE) © FerroCMS contributors

---

<div align="center">

**Keywords:** headless CMS · open source CMS · Cloudflare Workers CMS · Next.js CMS · Vue CMS ·
TypeScript CMS · serverless CMS · edge CMS · WordPress alternative · Keystatic alternative ·
Payload / Strapi / Directus alternative · Drizzle · Hono · R2 · Neon Postgres

If FerroCMS looks useful, please ⭐ the repo — it genuinely helps others discover it.

</div>
