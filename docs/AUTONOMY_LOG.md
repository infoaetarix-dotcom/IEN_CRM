# Autonomy Log — decisions made while you slept

**Session:** 2026-06-20, overnight. You granted full control for ~5–6 hours to finish Phases 2–4, test everything, and auto-accept my own changes. This file records every decision I'd normally have asked you about, plus anything worth a second look in the morning. Nothing here is hidden — it's here so debugging is fast if something looks off.

Legend: 🟢 routine/safe · 🟡 a real choice I made for you · 🔴 please review

---

## Pre-flight (before building)

- 🟢 **Brevo re-test after you authorized the IP.** Sent a second test email to `info.aetarix@gmail.com` — succeeded (`messageId` returned). Email pipeline confirmed. You'll have 2 ignorable test emails in your inbox.
- 🟡 **Left a test lead in the database.** "Aisha Test (Instagram)" (`utm_source=instagram`) inserted during Phase 1 verification. I kept it as sample data for building/testing the dashboard. Delete it anytime from the Leads page once you're happy.

---

## Phase 2 — Dashboard

- 🟢 **Auth via server actions** (`lib/auth/actions.ts`) using the user-session Supabase client, which sets the httpOnly cookies. Login is generic on failure ("Invalid credentials") and never reveals whether an email exists (README §8.9). Inactive accounts are blocked at login.
- 🟢 **Sign-in logs to audit_log** (`action: 'login'`).
- 🟡 **Native `<select>` instead of a Radix dropdown** for status/source/assignment pickers. Reason: accessible, dependency-light, robust, and posts naturally — better for an MVP than wiring heavy popover components. Easy to upgrade later.
- 🟡 **Status changes use a hybrid client pattern**: the user-session client performs the lead update (so RLS gates who can change it), and only after that succeeds do history + audit rows get written with the service role. This gives the defense-in-depth the spec asks for (app check + RLS + audit).
- 🟡 **Leads search sanitizes input** (strips `,()*`) before building the PostgREST `or()` filter, to avoid breaking the filter syntax. Max 80 chars. Functionally an ILIKE contains-search on name/email/phone.
- 🟡 **Agent self-protection**: an admin cannot deactivate or change the role of their own account (prevents locking yourself out). Enforced in `agents/actions.ts`.
- 🟢 **New staff created via service role** `auth.admin.createUser` with `email_confirm: true` (no email round-trip needed); the DB trigger creates the profile, then role/name are set.

---

## Phase 3 — Analytics & email

- 🟡 **Response-rate metric defined as**: of leads created in the last 30 days, the share whose *first* status change to "contacted" happened within 1 hour of creation. I used the status-history signal (not the auto-welcome email, which would fire within seconds and falsely inflate the rate). If you'd rather count the first staff-sent email as "contact" too, it's a one-line change in `app/(admin)/dashboard/page.tsx`. Shows "—" when there are no leads in the window.
- 🟢 **Charts** (Recharts): Leads by source (bar, only non-zero sources), Pipeline status (bar, all 6 statuses), Lead volume (line, last 14 days). Metrics computed by pure functions in `lib/leads/metrics.ts` (unit-tested in Phase 4).
- 🟢 **Email outreach** reuses the Phase-1 Brevo helper. Sends from a lead's profile: pick template → preview (variables shown) → send → logged to `messages` + audit. Templates are admin-editable at `/templates`; variable interpolation stays on the fixed allow-list.
- 🟢 **Dashboard/leads reflect RLS automatically** — an agent's dashboard only counts/charts their assigned leads, because reads go through the user-session client.

---

## Phase 4 — Hardening & tests

**All 5 security acceptance tests (README §8) — PASSED** (run live against your Supabase):
1. 🟢 Anonymous SELECT **and** INSERT on `leads` → `42501 permission denied`. Anon has zero table privilege (stronger than row-level denial).
2. 🟢 Agent A querying Agent B's lead → empty, both via REST (JWT) and through the **browser UI** (Playwright: list excludes it, direct URL returns 404).
3. 🟢 Rate limit → throttles after 5/window (unit-tested; live in `submitLead`).
4. 🟢 `<script>` in content → inert. No `dangerouslySetInnerHTML` anywhere in source; all user content React-escaped.
5. 🟢 Client bundle scan → service-role/Brevo/Turnstile-secret keys **absent**; only the public site key present (correct).

- 🟡 **Created and DELETED test users in your live database** to run these tests. I made temporary `ientest_*` and `e2e_*` accounts (admin + 2 agents) and a couple of throwaway leads, ran the isolation tests, then removed them all. **Final state verified: only your real admin (`abdrkdw21@gmail.com`) and the one "Aisha Test (Instagram)" sample lead remain.** The Playwright suite creates/destroys its own ephemeral users on each run via `global-setup`/`global-teardown`.
- 🔴 **Data-model finding (please read):** hard-**deleting a staff member** is intentionally **blocked** when they have audit/history references (`audit_log.actor_id`, `lead_status_history.changed_by`, etc. are RESTRICT/no-action). This protects the audit trail. The app therefore offboards staff via **Deactivate** (sets `is_active=false`), not deletion — which is the correct CRM behavior. If you ever truly need to purge a staff auth user, clear their audit references first (the e2e teardown shows how). Lead deletion is unaffected (cascades cleanly, as the spec requires).
- 🟡 **`server-only` stubbed in Vitest** (`tests/stubs/server-only.ts`): the real package throws outside a Server Component, which broke unit tests that import server modules directly. Standard fix; affects tests only, not the app.
- 🟢 **20 unit tests** (lead validation, UTM mapping, rate limit, metrics, template allow-list) + **6 e2e tests** (public pages, protected redirect, admin flow incl. status change, agent isolation) all pass.
- 🟡 **CI runs lint/typecheck/unit/build** but **not e2e**. Reason: e2e needs live Supabase + the service-role secret + a browser; wiring that into public CI safely means adding GitHub secrets, which is your call. Run `pnpm test:e2e` locally anytime. Details in `PROJECT_GUIDE.md`.

---

## Things for you to do in the morning (not blockers I could clear)

1. **Deploy to Vercel** — needs your login. Full steps in `PROJECT_GUIDE.md`.
2. **Final UAT** — run the client UAT script (in the guide) on a phone/browser.
3. **Rotate secrets** — the service-role/Brevo/Turnstile keys were pasted in chat; regenerate before real launch.
