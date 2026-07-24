---
layout: home
hero:
  name: FerroCMS
  text: Headless. Cloudflare-native. Open source.
  tagline: A database-backed CMS for JavaScript sites, with config-as-code content modeling and WordPress-parity features.
  actions:
    - theme: brand
      text: Get started
      link: /getting-started
    - theme: alt
      text: Content modeling
      link: /content-modeling
    - theme: alt
      text: View on GitHub
      link: https://github.com/locateanup/FerroCMS
features:
  - title: Runs anywhere
    details: Cloudflare Workers is the primary target, but the same API also runs on plain Node (Docker, a VPS, Render, Fly) — no vendor lock-in.
  - title: Config-as-code content
    details: Collections, fields, taxonomies, globals, and forms are defined in TypeScript. One definition drives the database schema, validation, admin UI, and API.
  - title: Cost-effective by default
    details: Turso (libSQL) instead of a always-on Postgres box, R2 for media, edge caching for public reads — built to run on the free tier for small-to-medium sites.
  - title: Real workflow, not just CRUD
    details: Drafts, scheduling, editorial review, revisions, audit log, comments, and full-text search — the parts of WordPress people actually rely on.
---
