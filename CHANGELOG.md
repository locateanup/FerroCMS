# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows [Semantic
Versioning](https://semver.org) — see [Versioning policy](./CONTRIBUTING.md#versioning-policy) for
what that means pre-1.0.

## [Unreleased]

### Added

- **Live preview**: `admin.previewUrlPattern` on a collection plus a Preview button in the entry
  editor — mints a real preview token and renders your front-end's preview route in an iframe inside
  the admin. `examples/next-site` ships a working `/preview/[collection]/[id]` route consuming it.
- **Drag-and-drop reordering** for rich-text blocks and repeater field rows (native HTML5 DnD, no
  external library — see `apps/admin/src/lib/dragReorder.ts`).
- **Presence**: a lightweight "who else is editing this" banner — heartbeats every ~8s while an entry
  is open, built on the existing KV adapter (`KVAdapter.list()`), no new platform primitive. Not live
  collaborative editing (no keystroke-level sync) — see the code comment in
  `apps/api/src/services/presence.ts` for why that's out of honest scope for a Workers+Node dual
  runtime.

## [0.1.0] — 2026-07-25

First tagged version. Everything below has real tests behind it (unit/integration via Vitest, one
end-to-end journey via Playwright) — see [Versioning policy](./CONTRIBUTING.md#versioning-policy) for
what "0.1.0" does and doesn't promise.

### Content modeling

- Collections, fields (text, number, boolean, date, select, JSON, rich text, relation, media,
  taxonomy, group, repeater), declarative conditional fields.
- Taxonomies (hierarchical or flat), globals/singletons, forms with public submissions.
- Localized fields with locale fallback, RTL locale detection.
- Revisions with restore, draft/published/scheduled/archived states, scheduled publishing.
- Editorial review workflow (submit → approve/reject), content calendar view.
- Bulk edit/clone/import/export.

### API

- Auto-generated REST per collection, GraphQL mirroring the same access control, a typed client SDK.
- Draft/preview tokens for live preview, webhooks on publish (HMAC-signed), full-text search (FTS5).
- SEO fields + `sitemap.xml`/`robots.txt`, redirect manager, comments with moderation.
- Edge/CDN caching for public reads with targeted invalidation on write.

### Users & security

- Session auth, RBAC (viewer/author/editor/admin), granular per-field access control.
- TOTP-based 2FA, PBKDF2 password hashing, rate limiting, security headers, persisted audit log.
- User management (invite/list/deactivate/roles).

### Platform

- Runs on Cloudflare Workers (R2 media, KV-backed sessions/cache) or plain Node (filesystem media) —
  same codebase, adapter-based.
- libSQL/Turso database; a genuinely local `file:`/`:memory:` database works for self-hosting on Node
  without a Turso account (see `@ferrocms/db/local`).
- Plugin system (`definePlugin`, custom field storage types, custom admin widgets/pages).

### Developer experience

- `create-ferrocms` CLI to scaffold a new project.
- VitePress docs site (getting started, content modeling, API reference, deployment, plugins,
  migrations).
- `examples/next-site` — a real Next.js 15 site consuming the SDK.
- Playwright E2E suite (`pnpm test:e2e`) against a real browser, a real Node API, and a real throwaway
  local database.

### Fixed

- Dependency audit: closed 54 of 55 findings from `pnpm audit` (2 critical, 20 high, 29 moderate, 4
  low → 0/0/0/0), including a SQL injection in `drizzle-orm` and an open-redirect/XSS pair in
  `react-router`. One high-severity finding remains open pending an upstream release — see
  [SECURITY.md](./SECURITY.md#dependency-audit).
- `pnpm format:check` (part of CI) now actually passes.
