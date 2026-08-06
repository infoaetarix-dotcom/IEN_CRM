# Handoff — current state, open items, roadmap

Last updated: 2026-08-03. Start here, then read [`../CLAUDE.md`](../CLAUDE.md).

**Context:** this is Aetarix's product; IEN is the first paying client and their
form is **live and collecting real applicants right now**. Treat `main` as
production at all times.

---

## Branching & deployment

`main` auto-deploys to production on push (~2 min). So:

1. **Never commit to `main` directly.** Branch: `feat/…`, `fix/…`, `docs/…`.
2. Push the branch — Vercel builds a **preview URL** for it automatically.
   Test there.
3. Open a PR into `main`. Ensure `pnpm typecheck && pnpm lint && pnpm test &&
   pnpm build` all pass, plus `pnpm test:e2e` for anything touching auth, leads
   or tenancy.
4. If the change needs a migration, the owner runs it in Supabase **before** the
   merge.
5. Merge, then **verify production** (load the form and the CRM, check the
   relevant surface actually works).

> Recommended: turn on **GitHub branch protection** for `main` (require a PR,
> block force-push). It isn't enabled yet — worth doing on day one.

**Environments today:** production only. There is no staging database; e2e tests
run against the real Supabase project (they create and clean up their own data).

---

## What is done and live

| Area | State |
|---|---|
| Public 3-step application form, progressive capture | live |
| Lead pipeline: list, filters, detail, notes, status, assignment | live |
| Manual lead editing (admin or assigned agent) | live |
| Archive / restore, permanent delete (admin, audited) | live |
| Dashboard metrics + charts | live |
| Email templates, transactional send, message log | live |
| **Phase A** — multi-tenant foundation, org-scoped RLS | live |
| **Phase B** — `/super` platform console (create org, modules, suspend, team) | live |
| Auth: roles, forced password change, self-service change, email reset | live |
| Per-tenant branding (logo + name), Aetarix platform brand | live |
| Form/CRM domain split via `FORM_HOST` | live |
| Keep-warm cron (stops free-tier idle pause) | live |

Migrations `0001`–`0007` are applied to production.

---

## Open items

### Should be done soon
- **Production database is full of test data.** ~19 seeded/demo/e2e leads
  ("test name", "hehe", `@example.com`). Only `Talha azfar` (2026-08-01) is a
  real applicant. The client should not see fake leads. Owner said he would
  delete these himself — confirm before client handover.
- **One real applicant never received a confirmation email.** Talha submitted on
  2026-08-01 while Brevo was blocking sends. Decide whether to re-send.
- **`/super` logo upload is built but never exercised.** IEN's logo is currently
  a static file (`public/ien-logo.png`) with `organizations.logo_url` pointing at
  it — a shortcut. **Consultancy #2's logo must go through the upload into
  Supabase Storage**, so test that path before onboarding another client.
- **No email-health visibility.** Every send is logged to `messages`, but nothing
  surfaces failures in the UI — which is why the Brevo outage went unnoticed for
  six weeks. A failed-send indicator on `/super` or the dashboard would prevent a
  repeat.
- **Deliverability is weak.** Mail sends from `info.aetarix@gmail.com`, a freemail
  address with no DKIM/DMARC, so it often lands in spam. Fix: verify
  `ieneducation.com` as a sender domain in Brevo and send from
  `noreply@ieneducation.com`.
- **No Aetarix square mark.** The wordmark stands in everywhere; a square icon is
  needed for tight spaces and a favicon.

### Accepted risks (owner's explicit decision)
- **No database backups.** Supabase free tier. A hard delete or bad migration is
  unrecoverable. Pro (~$25/mo) adds backups — declined for now.
- **Secrets have not been rotated** since being shared in June 2026:
  `SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, `TURNSTILE_SECRET_KEY`,
  `UPSTASH_REDIS_REST_TOKEN`. Steps in [`GO_LIVE.md`](GO_LIVE.md).

### Deferred by design
- **Owner/admin management** — today any admin can change another admin's role or
  deactivate them (only self-modification is blocked). The agreed model is one
  "owner" admin per org who alone manages other admins. Parked until the
  super-admin phase, since the owner is the paying account holder.
- **Impersonation / "view as tenant"** — super admins are deliberately kept out of
  the tenant CRM. If support access is needed later, build it explicitly with
  audit logging rather than relying on RLS.

---

## Roadmap

**Phase C — module gating** *(specced and planned, not built)*
Make the per-org module toggles in `/super` actually enforce access: nav
filtering, route guards and server-action guards, plus feature-level gating for
analytics and email. `leads` is a core module and always on.
→ Spec and task-by-task plan in `docs/superpowers/`. Branch:
`phase-c-module-gating`.

**Phase D — per-consultancy form links** *(not started)*
`/{slug}/apply` so each consultancy gets its own public intake URL. Today
`/apply` defaults to the `ien` slug (see `DEFAULT_ORG_SLUG`).

**UI/UX polish** *(in progress)*
Branding landed. Remaining: screen-by-screen design pass (dashboard, leads
table, lead detail), empty states for a brand-new tenant with zero leads, and
mobile — the CRM is desktop-first but staff will use phones.

---

## Working principle

The owner builds **floor by floor**: each layer is finished completely — built,
tested, deployed, verified, documented — before the next begins. Before starting
new work, audit the current layer for leftovers and surface them rather than
carrying debt forward.

---

## Stale documents

`PROJECT_GUIDE.md` (June 20) and `VISA-CRM-MVP-README.md` predate multi-tenancy,
`/super`, branding, password management and archive/delete. Treat
[`../CLAUDE.md`](../CLAUDE.md) and this file as current; those two as history.
