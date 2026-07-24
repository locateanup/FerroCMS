# Deployment

Same codebase, two runtimes — pick whichever fits your infrastructure. **A libSQL/Turso database is
the only hard requirement**, and sessions live in it too (no separate KV service to provision).

The runtime is chosen by which entry point runs (`src/index.ts` for Workers, `src/node.ts` for Node);
platform differences (object storage, KV, background tasks) sit behind small adapters
(`StorageAdapter`, `KVAdapter`, `CacheAdapter`), so the API, auth, media, SEO, and webhooks behave
identically on both.

## Cloudflare (edge)

```bash
wrangler r2 bucket create ferrocms-media
wrangler secret put DATABASE_URL            # your Turso libsql:// URL
wrangler secret put DATABASE_AUTH_TOKEN
wrangler secret put AUTH_SECRET
pnpm --filter @ferrocms/api deploy          # → your Workers account
```

Then deploy the admin (a Vite build, `apps/admin`) to Cloudflare Pages. Media uploads land in R2;
sessions and cache both live in your libSQL database, so there's no KV namespace to provision.

## Node (Docker / VPS / anywhere)

No Cloudflare account needed — uses filesystem storage for media; sessions/cache live in the database.

```bash
export DATABASE_URL="libsql://your-db.turso.io"
export DATABASE_AUTH_TOKEN="…"
export AUTH_SECRET="$(openssl rand -base64 32)"
export MEDIA_DIR="/var/lib/ferrocms/media"   # persist this volume
pnpm --filter @ferrocms/db db:push
pnpm --filter @ferrocms/api start:node       # serves the API on $PORT (default 8787)
```

Put this behind any reverse proxy (nginx, Caddy, Fly's built-in edge) for TLS. The admin SPA is a
static build — serve it from the same proxy or any static host, pointed at the API's URL.

## Environment variables

| Var | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | `libsql://...` (Turso) or a local `turso dev` URL |
| `DATABASE_AUTH_TOKEN` | yes (Turso) | Not needed for `turso dev` |
| `AUTH_SECRET` | yes | Random secret for session signing |
| `MEDIA_DIR` | Node only | Filesystem path for uploaded media |
| `SITE_URL` | for SEO | Used to build sitemap/canonical URLs |
| `SLACK_WEBHOOK_URL` / `DISCORD_WEBHOOK_URL` | optional | Notification channels |
| `NOTIFY_EMAIL_TO` | optional | Email notifications (via the configured `EmailProvider`) |

See `.env.example` at the repo root for the full, documented list.

## CI/CD

Every PR should run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` (the root `build` script
excludes `examples/*` via `--filter=!./examples/*`, since the Next.js example's static prerender needs
a live backend — CI for the example itself should run `pnpm --filter @ferrocms/example-next-site build`
separately, against a real deployed CMS URL).

## After deploying

1. Confirm `GET /health` returns `{ status: 'ok' }`.
2. Log into the admin, create an entry, publish it.
3. `curl https://your-api/api/posts` returns the published entry as JSON; drafts are excluded without
   auth.
4. Point `examples/next-site` (or your own site) at the deployed API URL and confirm it renders.
5. If you configured a webhook, confirm publishing an entry triggers your site's revalidation.
