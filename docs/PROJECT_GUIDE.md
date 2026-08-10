# IEN Visa CRM — Project Guide

**For:** the engineering owner (you), morning read.
**Status as of overnight build:** Phases 0–4 complete. App builds, all tests green, all 5 security acceptance tests pass. Ready for Vercel deployment + your UAT.

> Companion file: **`AUTONOMY_LOG.md`** lists every decision I made on your behalf while you slept. Read it if anything looks surprising.

---

## 1. What this is

A production-grade CRM for a study-abroad / student-visa consultancy. A public, UTM-tagged lead-capture form feeds a secure admin dashboard. Built exactly to `VISA-CRM-MVP-README.md`, with two locked decisions: **date of birth** (not age) and **assigned-only** agent visibility.

**Stack:** Next.js 15 (App Router, TS strict) · Supabase (Postgres + Auth + RLS) · Brevo email · Cloudflare Turnstile · Tailwind + shadcn-style UI · Recharts · Vitest + Playwright. Deployed target: Vercel.

---

## 2. Current status — Definition of Done

| Item | State |
|---|---|
| Public form: validated, bot-protected, consent-gated, source-tracked | ✅ |
| Submissions land in Supabase, appear in dashboard | ✅ |
| Confirmation email fires on submit + logged | ✅ (Brevo verified) |
| Admin + Agent auth; agent scoping enforced in DB (RLS) | ✅ |
| Leads table: search, filter, sort, server pagination | ✅ |
| Lead detail: status pipeline, append-only notes, history, assignment, templated email | ✅ |
| Dashboard analytics (source, pipeline, volume, response rate) | ✅ |
| All 5 security acceptance tests pass | ✅ |
| Privacy/consent; no government-ID/financial fields | ✅ |
| CI green (lint, typecheck, unit, build) | ✅ |
| Deployed to Vercel (prod, domain, DNS) | ⛔ **your step** (§6) |
| Client UAT script passes | ⛔ **your step** (§7) |

---

## 3. Run it locally

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

Key URLs:
- `/` — landing page
- `/apply` — public lead form (try `/apply?utm_source=instagram&utm_medium=bio`)
- `/login` — staff sign-in
- `/dashboard`, `/leads`, `/agents`, `/templates` — admin area (auth-gated)

**Your admin login:** the account you created in Supabase — `abdrkdw21@gmail.com` with the password you set. (I never saw that password.) If you forget it, reset via Supabase → Authentication → Users.

---

## 4. Project structure (high level)

```
app/
  (public)/apply/      form page, client form, submitLead action
  (public)/thank-you/  success page
  (admin)/             layout guard + dashboard, leads, agents, templates
  login/               staff sign-in
  api/health/          uptime check
components/  ui/ (primitives), form/, dashboard/, charts/
lib/
  supabase/  client.ts (anon) · server.ts (user session) · service.ts (service role)
  validation/lead.ts   shared Zod schema (DOB)
  security/  turnstile.ts · rate-limit.ts
  auth/      guards.ts · actions.ts
  email/brevo.ts       send + logging (allow-list interpolation)
  leads/     display.ts (labels/colors) · metrics.ts (pure, unit-tested)
  audit.ts
supabase/migrations/0001_init.sql   schema + RLS + grants (DOB)
supabase/seed.sql                   templates + admin-promote note
tests/unit/ (vitest)  tests/e2e/ (playwright)
middleware.ts         session refresh + /admin guard
next.config.mjs       security headers (CSP/HSTS/etc.)
```

---

## 5. Environment variables

All set in `.env.local` (gitignored). For deployment you set the **same** keys in Vercel.

| Variable | Purpose | Public? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | yes |
| `NEXT_PUBLIC_APP_URL` | App base URL (set to your prod domain on Vercel) | yes |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Turnstile site key | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS — server only | **NO** |
| `TURNSTILE_SECRET_KEY` | Turnstile verify — server only | **NO** |
| `BREVO_API_KEY` | Email send — server only | **NO** |
| `BREVO_SENDER_EMAIL` / `BREVO_SENDER_NAME` | Sender identity | server |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | Optional distributed rate limit | server |

> ⚠️ **Rotate the three secrets before real launch** — they were pasted in chat during setup. Regenerate in each dashboard and update `.env.local` + Vercel.

---

## 6. Deploy to Vercel (your step, ~15 min)

1. Push is already on GitHub: `infoaetarix-dotcom/IEN_CRM` (branch `main`).
2. [vercel.com](https://vercel.com) → **Add New → Project** → import the repo. Framework auto-detects Next.js. Build command `pnpm build`, install `pnpm install`.
3. **Environment Variables** → add every row from §5 (copy from `.env.local`). Set `NEXT_PUBLIC_APP_URL` to your real domain.
4. Deploy. You'll get `https://<project>.vercel.app`.
5. **Custom domain (optional but recommended):** Vercel → Settings → Domains → add `crm.yourdomain.com`, follow the DNS instructions.
6. **Turnstile:** add your production domain in the Cloudflare Turnstile dashboard (currently configured for `localhost`).
7. **Email deliverability:** in Brevo, authenticate your sending **domain** (SPF + DKIM) and switch `BREVO_SENDER_EMAIL` to `apply@yourdomain.com`. The Gmail sender works for testing but a real domain greatly improves deliverability.
8. **Rotate secrets** (see §5) and update them in Vercel.

> **Important — Brevo "Authorized IPs":** keep this setting **OFF** (you already disabled it). Vercel's serverless IPs are dynamic; an allowlist would silently break confirmation emails in production.

---

## 7. Client UAT script (run after deploy)

1. Open a bio link on your phone: `…/apply?utm_source=instagram&utm_medium=bio`. Confirm it looks professional and loads fast.
2. Submit a test application.
3. Confirm the prospect receives a confirmation email within a minute.
4. Sign in as **Admin** → the new lead appears with **source = Instagram** and **status = New**.
5. Open the lead → add a note → change status to **Contacted** → confirm the note + status-history entry recorded.
6. Send the **Acceptance** email from the lead's profile → confirm it arrives and is logged in Message history.
7. Create an **Agent** in the Agents page → assign the lead to them.
8. Sign in as that Agent → they see the assigned lead and **cannot** see others' leads.
9. Open the **Dashboard** → metric cards and charts reflect the activity.
10. Submit more leads from different bio links → the source chart updates.

**Bio links to give the client** (replace the domain after deploy):

| Platform | Link |
|---|---|
| Instagram | `https://YOURDOMAIN/apply?utm_source=instagram&utm_medium=bio` |
| Facebook | `https://YOURDOMAIN/apply?utm_source=facebook&utm_medium=bio` |
| LinkedIn | `https://YOURDOMAIN/apply?utm_source=linkedin&utm_medium=bio` |
| YouTube | `https://YOURDOMAIN/apply?utm_source=youtube&utm_medium=bio` |
| WhatsApp | `https://YOURDOMAIN/apply?utm_source=whatsapp&utm_medium=bio` |
| Campaign | add `&utm_campaign=<name>` to any link |
| Direct | `https://YOURDOMAIN/apply` (recorded as `direct`) |

---

## 8. Testing

```bash
pnpm typecheck     # strict TS, no errors
pnpm lint          # eslint, clean
pnpm test          # 20 unit tests (vitest)
pnpm test:e2e      # 6 browser tests (playwright) — needs .env.local + chromium
pnpm build         # production build
```

- **Unit:** lead validation, UTM mapping, rate limit, dashboard metrics, email template allow-list.
- **E2E:** public pages + protected-route redirect; admin sign-in → open lead → change status; **agent isolation** (agent can't see another agent's lead, in the UI). The suite creates and destroys its own throwaway users each run.
- **Security acceptance tests (all 5 pass):** see `AUTONOMY_LOG.md` → Phase 4.
- **CI** (`.github/workflows/ci.yml`): lint + typecheck + unit + build on every push. E2E is intentionally not in CI (needs live Supabase + secrets); add GitHub secrets and a job if you want it there.

---

## 9. Security summary (what protects the data)

- **Two independent layers** on every protected operation: app-level guards (`requireUser`/`requireRole`) **and** database RLS. A UI bug cannot leak data.
- **Public form** is the only unauthenticated write — hardened with Zod (server re-validates), IP rate limit, honeypot, and server-verified Turnstile. The browser has **no** DB write access; inserts go through the service role server-side.
- **Secrets** are server-only (`import 'server-only'`), never in the client bundle (verified).
- **Audit log** records logins, status changes, assignments, sends, profile changes.
- **Security headers** (CSP, HSTS, X-Frame-Options DENY, etc.) in `next.config.mjs`.
- **PII minimization:** no passport/ID/financial fields. Explicit consent stored with timestamp.

---

## 10. Open items (from spec §19) — your decisions

These have sensible defaults implemented; confirm when convenient:
1. **Domain** for form/email (drives bio links + sender). — pending
2. **Brand assets** (logo, final colors) — using the pitch palette.
3. **Privacy policy URL + lawful basis** — the consultancy's legal responsibility; the form links to a policy and records consent. Currently the consent text links to `#` — **add a real privacy-policy URL** before launch.
4. **Data retention period** — document with the client; deletion capability is in place.
5. **Bilingual labels** (English + Roman Urdu) — off by default; say the word to enable.

---

## 11. What I did NOT change / could not do

- **No deployment** — needs your Vercel login (§6).
- **No secret rotation** — your call (§5).
- **Did not touch your Supabase Auth settings** beyond creating/deleting test users (all cleaned up).
- The consent checkbox links to a placeholder privacy URL — wire the real one.

---

## 12. Path to the full CRM (post-approval)

The schema already accommodates Phase 2 work: social chatbot (add a webhook route; chatbot hands users the same form link with `utm_medium=chatbot`), WhatsApp (add `'whatsapp'` to `message_channel`; the messages log + send UI are channel-agnostic), bulk outreach (extends the send+log flow), document uploads (Supabase Storage). No rebuild required.
