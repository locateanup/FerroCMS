# FerroCMS

> An open-source, headless, **Cloudflare-native** CMS for JavaScript sites.

FerroCMS gives your Next.js / Vue / any-JS sites a WordPress-class content backend that runs entirely
on Cloudflare's edge — Workers, R2, KV, Queues, and serverless Postgres. Define your content types in
TypeScript, edit them in a clean admin UI, and consume them through an auto-generated typed API.

**Status:** early development (Phase 1 — MVP core). Not yet production-ready. Follow the roadmap below.

## Why

Git-based tools like Keystatic are great for simple content, but lack a database, users/roles, a media
library, a dynamic API, and an extension system. FerroCMS aims for WordPress-level capability with a
modern, edge-first, type-safe architecture — and stays headless so you keep full control of your
front-end.

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

## Monorepo layout

```
apps/
  api/       Hono Worker — REST API, auth, media, webhooks
  admin/     React + Vite admin dashboard
packages/
  core/      content-type / field definitions, validation, hook engine
  db/        Drizzle schema + migrations
  sdk/       typed client for your front-end sites
examples/
  next-site/ sample Next.js site consuming the CMS
```

## Quick start

```bash
pnpm install
cp .env.example .dev.vars        # fill in DATABASE_URL + AUTH_SECRET
pnpm --filter @ferrocms/db db:push   # create tables on your Neon database
pnpm dev                          # runs the API worker + admin SPA
```

Then open the admin at `http://localhost:5173`.

## Roadmap

- **Phase 1 — MVP core:** content types, fields, RBAC, media library, draft/publish, auto REST API.
- **Phase 2 — Production-real:** block editor, relations, taxonomies, revisions, SEO, i18n, SDK, webhooks.
- **Phase 3 — Extensibility:** plugin/hook system, GraphQL, SSO, search, backups.
- **Phase 4 — Ecosystem:** page builder, real-time collab, comments, forms, e-commerce, AI, marketplace.

See the full plan and feature catalog in [`docs/`](./docs) (coming soon).

## Contributing

Contributions are welcome — see [CONTRIBUTING.md](./CONTRIBUTING.md). Please also read our
[Code of Conduct](./CODE_OF_CONDUCT.md) and [security policy](./SECURITY.md).

## License

[MIT](./LICENSE)
