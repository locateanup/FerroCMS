# Security Policy

## Supported versions

FerroCMS is in early development. Security fixes are applied to the `main` branch and the latest
released version.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Instead, report privately via GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository, or email the maintainers.

Please include:

- A description of the vulnerability and its impact.
- Steps to reproduce or a proof of concept.
- Any suggested remediation.

We aim to acknowledge reports within 72 hours and to provide a fix or mitigation timeline after triage.
Please give us reasonable time to address the issue before public disclosure.

## Dependency audit

`pnpm audit` is run as part of hardening the dependency tree. Findings are fixed by bumping the
affected package (verified against the real test/E2E suite, not just a version bump) or, for
transitive dependencies pinned by a parent package, via a `pnpm.overrides` entry in the root
`package.json`.

**Known accepted risk:** `react-router` (pulled in by `react-router-dom`) has an open advisory
(GHSA-qwww-vcr4-c8h2, a CSRF bypass in **RSC/framework-mode data routers**) with no fix released for
`react-router-dom` 7.x as of this writing — the fix landed in `react-router` 8.x, which
`react-router-dom` hasn't been republished against yet. The admin SPA only uses classic declarative
routing (`BrowserRouter`/`Routes`/`Route`, no loaders/actions, no RSC), so this specific vector isn't
reachable here. Revisit when `react-router-dom` publishes a release depending on `react-router` ^8.
