# IEN CRM — a multi-tenant CRM for study-abroad consultancies

Built by **Aetarix**. Each consultancy is a tenant with its own staff, data,
branding and package of modules. **IEN (International Education Network) is the
first client, not the product** — nothing should be hardcoded to them.

| | |
|---|---|
| Public application form | https://form.ieneducation.com |
| Staff CRM | https://portal.ieneducation.com |
| Repo | `infoaetarix-dotcom/IEN_CRM` |
| Hosting | Vercel — **pushing to `main` deploys to real users** |
| Database | Supabase (Postgres + Auth + RLS) |

**New here? Read [`CLAUDE.md`](CLAUDE.md) and [`docs/HANDOFF.md`](docs/HANDOFF.md) first.**

## Stack

Next.js 15 (App Router, TypeScript strict) · Supabase · Tailwind ·
Brevo (email) · Cloudflare Turnstile · Upstash Redis (rate limiting) ·
pnpm · vitest (unit) · Playwright (e2e).

## Local setup

```bash
pnpm install
```

Create `.env.local` in the project root (it is gitignored — never commit it).
Ask the project owner for the values:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
BREVO_API_KEY=
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Per-consultancy custom domains (`form_domain` / `portal_domain`) are
configured in Super Admin, not via env vars — see `docs/FORM_SUBDOMAIN.md`.
There's nothing to set locally for this.

```bash
pnpm dev     # http://localhost:3000
```

## Commands

```bash
pnpm dev          # dev server
pnpm build        # production build
pnpm typecheck    # tsc --noEmit
pnpm lint
pnpm test         # unit tests (vitest)
pnpm test:e2e     # end-to-end (Playwright) — hits the real Supabase project
```

Before any merge: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

> **E2E note:** kill anything already listening on port 3000 first — Playwright
> reuses an existing server and will silently test a stale build.

## Database

Migrations live in `supabase/migrations/` and are applied **by a human** in the
Supabase SQL editor, in order. `0001`–`0007` are already applied to production.

Adding one: create `NNNN_description.sql`, ask the owner to run it, **then**
merge the code that depends on it. Never edit an applied migration.

## Routes

| Path | Who |
|---|---|
| `/{slug}/apply`, `/thank-you` | applicants (public) |
| `/login`, `/update-password`, `/change-password` | auth |
| `/dashboard`, `/leads`, `/agents`, `/templates` | consultancy staff |
| `/super`, `/super/orgs/[id]` | Aetarix platform admin |
| `/api/health`, `/api/keep-warm` | uptime + free-tier keep-warm cron |

## Branching

`main` is production. Work on a branch, open a PR, let the Vercel preview build,
merge once checks pass. See [`docs/HANDOFF.md`](docs/HANDOFF.md#branching--deployment).

## Documentation

| File | Contents |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Architecture, conventions and rules (loaded by Claude Code) |
| [`docs/HANDOFF.md`](docs/HANDOFF.md) | Current state, open items, roadmap |
| [`docs/MULTI_TENANCY.md`](docs/MULTI_TENANCY.md) | Tenancy and RLS model |
| [`docs/GO_LIVE.md`](docs/GO_LIVE.md) | Production hardening checklist |
| [`docs/FORM_SUBDOMAIN.md`](docs/FORM_SUBDOMAIN.md) | Form/CRM domain split |
| [`docs/TESTING_GUIDE.md`](docs/TESTING_GUIDE.md) | Test strategy |
| [`docs/STAFF_GUIDE.md`](docs/STAFF_GUIDE.md) | End-user guide for consultancy staff |
| `docs/superpowers/` | Specs and plans for upcoming phases |
