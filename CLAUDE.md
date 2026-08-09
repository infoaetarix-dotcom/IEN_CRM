# CLAUDE.md — IEN CRM

Instructions for Claude Code working in this repo. Read this before changing anything.

## What this is

A **multi-tenant SaaS CRM for study-abroad consultancies**, built by **Aetarix**.
Aetarix is the platform owner; each consultancy is a tenant with its own staff,
data, branding and package of modules. **IEN (International Education Network)
is the first client — not the product.** Never hardcode a client's name, colours
or copy: anything tenant-specific comes from the `organizations` row.

Two audiences, two surfaces:
- **Applicants** — a public 3-step form (`/{slug}/apply`, one per consultancy)
  that captures leads progressively.
- **Consultancy staff** — the CRM (`/dashboard`, `/leads`, `/agents`, `/templates`).
- **Aetarix** — the platform console (`/super`) to onboard and configure tenants.

## Non-negotiable rules

1. **`main` is the client's live production.** Pushing to `main` auto-deploys to
   real users within ~2 minutes. Never commit directly to `main` — work on a
   branch and merge only after tests pass (see Workflow).
2. **Migrations are run by a human**, never by you. Write the SQL to
   `supabase/migrations/NNNN_name.sql`, then ask the user to run it in the
   Supabase SQL editor. Migrations already applied are immutable — add a new one.
3. **Run the migration before merging code that reads the new columns**, or
   production breaks.
4. **RLS is the security backstop, not the feature layer.** Guards in
   `lib/auth/guards.ts` are the first check; RLS policies are the second. Both.
5. **Never weaken tenant isolation.** Every tenant table has `organization_id`
   and org-scoped RLS. Writes must stamp it.
6. **Verify before claiming done**: `pnpm typecheck && pnpm lint && pnpm test`,
   plus `pnpm build`. E2E (`pnpm test:e2e`) hits the real Supabase project.
   GitHub Actions runs the same four steps on every PR (`.github/workflows/ci.yml`)
   with dummy env vars and no `.env.local` — so never rely on a real credential
   being present at build time.

## Stack

Next.js 15 (App Router, TS strict) · Supabase (Postgres + Auth + RLS) ·
Tailwind + shadcn-style primitives · Brevo (email) · Cloudflare Turnstile ·
Upstash Redis (rate limit) · Vercel (hosting) · pnpm · vitest + Playwright.

## Architecture

**Multi-tenancy.** `organizations` + `organization_modules` (per-tenant feature
packages) + `is_super_admin` on `profiles`. Helpers `current_org()`,
`is_admin()`, `is_super_admin()` back every RLS policy. Super admins have
cross-org access, so they are redirected out of the tenant CRM to `/super`.

**Auth & roles.** `admin` and `agent` per org, plus platform super admin.
Agents see only leads assigned to them; admins see their org's. New staff are
created with a temporary password and `must_change_password`, which forces
`/change-password` on first login. Password reset is app-owned (below).

**Branding (`lib/branding/`).** `AETARIX` is the static platform brand;
`getOrgBrand()` / `getPublicOrgBrand()` resolve the tenant's name, legal name
and logo. Missing logo → initials monogram, never a broken image. The
consultancy's brand leads their CRM; Aetarix appears as quiet attribution.

**Email (`lib/email/brevo.ts`).** Everything goes through the **Brevo HTTP
API** — not Supabase SMTP. `sendTransactionalEmail()` is the raw transport;
`sendEmail()` wraps it for lead mail and logs every attempt to `messages`
(`queued → sent | failed`). Password resets mint a link via
`admin.generateLink()` and send it ourselves, so the link is on our domain
(`/auth/confirm`) and can be branded per tenant later.

**Domain split.** Per-org `form_domain` / `portal_domain` columns on
`organizations`, set exclusively in Super Admin (`/super/orgs/{id}` →
Domains) — never tenant self-service. `lib/routing/domain-lookup.ts` resolves
the request Host header to an org; `lib/routing/domain-routing.ts` holds the
pure routing rules; `middleware.ts` applies them. A `form_domain` serves only
that org's `/{slug}/apply`; a `portal_domain` serves the full CRM but blocks
`/super` and signs out any session that isn't that org's own. No custom
domain is configured today — everything currently runs on the base app
domain, same as before this existed. See `docs/FORM_SUBDOMAIN.md`.

## Conventions

- **Server actions** live beside their route (`app/(admin)/leads/actions.ts`),
  start with a guard, validate with **Zod**, return `{ ok, error }` — they don't
  throw at the UI. Guards `redirect()`.
- **Validation is shared** between client and server: `lib/validation/lead.ts`
  is the single source. The server always re-validates.
- **Optional coded columns must be stored as `NULL`, not `''`** — the DB CHECK
  constraints reject empty strings (see `updateLead`).
- Server-only modules import `'server-only'`. Client components need `'use client'`.
- Use the service-role client (`lib/supabase/service.ts`) only where RLS must be
  bypassed deliberately (public form insert, `/super`, audit log).
- Match the surrounding style: comments explain *why*, not *what*.

## Workflow

```bash
pnpm dev            # local dev (port 3000)
pnpm typecheck      # tsc --noEmit
pnpm lint
pnpm test           # vitest unit tests
pnpm test:e2e       # Playwright — needs Supabase awake + .env.local
pnpm build
```

Branch → build → test → merge to `main` → verify production.
Every branch gets its own Vercel preview URL; test there before merging.
Never leave `main` broken: the client is using it right now.

## Gotchas that have bitten us

- **Brevo "Authorised IPs" must stay OFF.** Vercel sends from dynamic IPs. When
  on, every email fails silently (`401 unrecognised IP address`) — it went
  unnoticed for six weeks. Diagnose with `GET https://api.brevo.com/v3/account`
  or by checking `messages.status='failed'`.
- **Supabase free tier pauses after ~7 days idle**, which would kill the live
  form. A daily Vercel cron (`/api/keep-warm`, `vercel.json`) prevents it.
  There are **no database backups** on this tier.
- **Kill stray dev servers on port 3000 before e2e** — Playwright's
  `reuseExistingServer` will silently serve a stale build.
- Playwright `getByLabel('New password')` also matches "Confirm new password";
  use `{ exact: true }`.

## Where to look

- `README.md` — setup and commands.
- `docs/HANDOFF.md` — current state, open items, roadmap. **Start here.**
- `MULTI_TENANCY.md` — the tenancy model.
- `docs/GO_LIVE.md`, `docs/FORM_SUBDOMAIN.md` — operational runbooks.
- `docs/superpowers/` — specs and implementation plans for upcoming phases.
- `supabase/migrations/` — schema history; read these to understand the data model.
