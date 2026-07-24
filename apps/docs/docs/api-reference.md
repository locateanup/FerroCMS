# API reference

FerroCMS auto-generates a REST API from your collections, plus a mirrored GraphQL endpoint and a
typed client SDK for consuming content from your front-end. Every route enforces the same access
control server-side, regardless of which door you come through.

## Auth

Session-based, backed by the database (no separate KV/Redis needed for sessions).

| Route | Notes |
|---|---|
| `POST /api/auth/register` | First registered user becomes `admin` |
| `POST /api/auth/login` | Sets a session cookie |
| `POST /api/auth/logout` | — |
| `GET /api/auth/me` | Current user, or `null` |
| `POST /api/auth/2fa/*` | TOTP-based two-factor setup/verify |

## Collections (`/api/:collection`)

Every `defineCollection` gets these routes automatically (`collection` = the collection's `slug`):

| Method & path | Access | Notes |
|---|---|---|
| `GET /api/:collection` | collection's `read` | List, paginated (`limit`/`offset`), filterable |
| `GET /api/:collection/export` | collection's `read` | Bulk export as JSON |
| `GET /api/:collection/:id` | collection's `read` | Single entry |
| `POST /api/:collection` | collection's `create` | Create |
| `POST /api/:collection/import` | collection's `create` | Bulk import from JSON |
| `PATCH /api/:collection/bulk` | collection's `update` | Bulk update by id list |
| `PATCH /api/:collection/:id` | collection's `update` | Update |
| `DELETE /api/:collection/bulk` | collection's `delete` | Bulk delete by id list |
| `DELETE /api/:collection/:id` | collection's `delete` | Delete |
| `POST /api/:collection/:id/clone` | collection's `create` | Duplicate an entry as a new draft |
| `POST /api/:collection/:id/preview-token` | editor+ | Mint a short-lived draft preview token |
| `GET /api/:collection/:id/preview` | token | Fetch the draft using a preview token |
| `GET /api/:collection/:id/revisions` | collection's `read` | Revision history |
| `POST /api/:collection/:id/revisions/:revisionId/restore` | collection's `update` | Restore a revision |
| `POST /api/:collection/:id/submit-for-review` | author+ | Editorial workflow: request review |
| `POST /api/:collection/:id/review` | editor+ | Approve/reject a pending review (`{approved, note?}`) |

`GET /api/collections` returns every collection's field schema (functions stripped) so the admin — or
any other client — can render forms without hardcoding field definitions.

## Globals (`/api/globals/:slug`)

| Method & path | Notes |
|---|---|
| `GET /api/globals/:slug` | Read the single document |
| `PATCH /api/globals/:slug` | Update it (editor+ by default) |

## Forms (`/api/forms`)

| Method & path | Access | Notes |
|---|---|---|
| `GET /api/forms` | authenticated | List form schemas |
| `POST /api/forms/:slug/submit` | public, rate-limited | Submit — validated against the form's fields |
| `GET /api/forms/:slug/submissions` | editor+ | List submissions |
| `DELETE /api/forms/:slug/submissions/:id` | editor+ | Remove a submission |

## Other endpoints

| Route | Notes |
|---|---|
| `GET /health` | Liveness check |
| `GET /sitemap.xml` | Generated from published, non-`noindex` entries of SEO-enabled collections |
| `GET /robots.txt` | Allows crawling, points at the sitemap |
| `/api/media/*` | Upload/list/delete media (R2 on Workers, filesystem on Node) |
| `/api/users/*` | Invite/list/deactivate users, role management (admin only) |
| `/api/audit-log` | Persisted audit trail of writes (admin only) |
| `/api/search` | Full-text search (FTS5) across collections |
| `/api/redirects` | Redirect manager (admin only) |
| `/api/comments` | Submit/moderate comments |
| `/api/calendar` | Content calendar view (scheduled/published entries by date) |
| `/api/dashboard` | Admin dashboard widget data |
| `/api/system` | Version/health info for the admin's status page |
| `GET`/`POST /graphql` | GraphQL, mirrors REST access control exactly |

## GraphQL

```graphql
query {
  entries(collection: "posts", limit: 10) {
    total
    items {
      id
      slug
      data
    }
  }
}
```

`data` is a JSON scalar carrying the collection's full field data — there's no per-collection GraphQL
type generation, so it stays in sync with `defineCollection` automatically.

## Webhooks

Configure a webhook URL and FerroCMS `POST`s a signed payload (HMAC over the body, verify against your
own secret) whenever an entry is published, so your front-end can trigger an ISR/on-demand revalidation.

## Client SDK

```ts
import { createClient, buildMeta, metaTags, renderRichTextHtml, localize } from '@ferrocms/sdk';

const client = createClient({ url: 'https://cms.example.com' });

const { items } = await client.find('posts', { limit: 10 });
const post = await client.findBySlug('posts', 'hello-world');

const meta = buildMeta(post, { siteUrl: 'https://mysite.com', urlPattern: '/blog/:slug' });
const tags = metaTags(meta); // -> [{ tag: 'title', text }, { tag: 'meta', attrs }, ...]

const html = renderRichTextHtml(post.data.body, { mediaUrl: client.mediaUrl });

const localized = localize(page.data, ['body'], 'fr', 'en'); // falls back to 'en'

const draft = await client.preview('posts', id, token); // live preview, via a minted token
```

The SDK is dependency-free and ships built (`dist/`) so it works under any bundler (webpack/Next.js,
Vite, esbuild) — see [examples/next-site](https://github.com/locateanup/FerroCMS/tree/main/examples/next-site)
for a full Next.js integration.
