# Contributing to FerroCMS

Thanks for your interest in improving FerroCMS! This project is in early development, so contributions,
ideas, and bug reports are all valuable.

## Getting set up

1. Install [Node.js](https://nodejs.org) 20+ and [pnpm](https://pnpm.io) 10+.
2. Fork and clone the repo.
3. `pnpm install`
4. Copy `.env.example` to `.dev.vars` and add a Turso `DATABASE_URL`/`DATABASE_AUTH_TOKEN` (or a local
   `turso dev` URL) and an `AUTH_SECRET`.
5. `pnpm --filter @ferrocms/db db:push` to create the schema.
6. `pnpm dev` to start the API worker and admin SPA.

## Before you open a PR

Run the full quality gate locally — CI runs the same checks and will block merge on failure:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check
```

If you touched the admin UI or an API route it depends on, also run the Playwright end-to-end suite
(login, publish a post, upload media — a real browser against a real, throwaway local database, no
Turso account needed):

```bash
pnpm test:e2e
```

The first run downloads a Chromium build via `pnpm --filter @ferrocms/e2e exec playwright install
chromium`.

## Guidelines

- **Type safety first.** No `any` without a comment explaining why. Prefer inferring types from the
  content-type definitions rather than hand-writing them.
- **Validate all input** with Zod at the API boundary; never trust request bodies.
- **Keep the core small.** New integrations and non-essential features should be plugins, not core code.
- **Write tests** for new behavior — unit for logic, integration for API routes.
- **Conventional commits** (`feat:`, `fix:`, `docs:`, `chore:`, ...) help generate the changelog.

## Reporting bugs

Open an issue with reproduction steps, expected vs. actual behavior, and your environment. For security
issues, follow [SECURITY.md](./SECURITY.md) instead of opening a public issue.
