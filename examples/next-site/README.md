# FerroCMS example: Next.js site

A real Next.js (App Router) site that fetches content from FerroCMS via
`@ferrocms/sdk` — proving the headless loop end-to-end: define a collection →
edit it in the admin → fetch it here and render a page.

## What it demonstrates

- `app/page.tsx` — lists published `posts` (`client.find`)
- `app/blog/[slug]/page.tsx` — a single post by slug (`client.findBySlug`),
  rendering its rich-text `body` via `renderRichTextHtml` and building
  `<title>`/meta tags via `buildMeta`
- `app/[slug]/page.tsx` — a single `pages` entry, demonstrating localized
  fields (`localize()`) and RTL layout (`isRtlLocale()`) via a `?lang=` query
  param (try `/about?lang=fr` or `/about?lang=ar`)

## Running it

1. Start FerroCMS itself (from the repo root):
   ```bash
   pnpm --filter @ferrocms/api start:node
   ```
   (or point `NEXT_PUBLIC_FERROCMS_URL` at a deployed Worker instead)
2. Copy the env file and adjust if needed:
   ```bash
   cp .env.example .env.local
   ```
3. Create at least one published `posts` entry and one published `pages`
   entry in the FerroCMS admin so there's something to render.
4. From this directory:
   ```bash
   pnpm install
   pnpm dev
   ```
5. Open http://localhost:3000.
