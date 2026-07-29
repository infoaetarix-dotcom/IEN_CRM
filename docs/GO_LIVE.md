# Go-Live Hardening Checklist — IEN client handoff

Run this **before** promoting the form link to the client's real student clients.
Production is `main` → https://ien-crm.vercel.app (auto-deploys on push).
Supabase project ref: `mmtcmpfvbfigzuatyhll`.

Legend: 🧑 = you do it in a dashboard · 🤖 = Claude can help/verify.

---

## 1. Supabase — stop the free-tier pause (highest priority) 🧑

The free tier **pauses the database after ~7 days idle**. If that happens while
the client is collecting leads, the form silently stops accepting submissions.

- [ ] Upgrade the project to **Pro** — Supabase dashboard → project
      `mmtcmpfvbfigzuatyhll` → **Settings → Billing → upgrade to Pro** (~$25/mo).
      This removes the idle pause and adds daily backups + more capacity.
- [ ] (If you truly can't upgrade yet) interim keep-warm: a daily cron that runs
      one cheap query so the DB never idles out. This is a stopgap, **not** a
      substitute for Pro on a client-facing product — no backups, still capacity-limited.

## 2. Rotate secrets (they were pasted in chat in June) 🧑 + 🤖

Rotate each secret at its provider, then update **both** places it lives —
Vercel **Production** env vars and your local `.env.local` — then redeploy.

| Secret | Where to rotate | Notes |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | See the ⚠️ note below — Supabase key rotation is special. |
| `BREVO_API_KEY` | Brevo → SMTP & API → API Keys → delete old, create new | Email send key. |
| `TURNSTILE_SECRET_KEY` | Cloudflare → Turnstile → your widget → Rotate secret | Bot-check secret. Rotating the widget may also issue a new site key. |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash console → your Redis DB → rotate REST token | Rate-limit store. |

⚠️ **Supabase key nuance — check which key system your project uses first:**
- **Legacy JWT keys** (anon + service_role are JWTs): they can only be rotated by
  regenerating the project's **JWT secret**, which invalidates *both* keys at once
  and **signs every user out**. Plan for a moment of downtime + updating
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` *and* `SUPABASE_SERVICE_ROLE_KEY` together.
- **New API keys** (publishable + secret): the secret key rotates independently
  with no user logout. Much cleaner.
- The `anon` / publishable key is **public by design** (RLS protects the data), so
  the truly sensitive one to rotate is the **service-role / secret** key.
- 🤖 When you're in the dashboard, tell me which key system you see and I'll give
  you the exact clicks + which env vars to update.

## 3. Vercel environment 🧑 + 🤖

- [ ] After each rotation, update the value in **Vercel → ien-crm → Settings →
      Environment Variables** (Production scope), then **redeploy** (or push any
      commit) so prod picks it up.
- [ ] Confirm every key the app needs is present in Production:
      `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
      `TURNSTILE_SECRET_KEY`, `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`,
      `BREVO_SENDER_NAME`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
      `NEXT_PUBLIC_APP_URL` (= `https://ien-crm.vercel.app`).

## 4. Email deliverability (Brevo) 🧑

- [ ] Keep **Authorized IPs OFF** — serverless IPs are dynamic; turning this on has
      broken sends before.
- [ ] Verify the sender domain (SPF + DKIM) in Brevo so the welcome email doesn't
      land in spam for students.

## 5. Post-rotation smoke test 🤖 + 🧑

- [ ] Submit a real test lead on **prod** `/apply` → confirm it appears in `/leads`
      and the welcome email arrives.
- [ ] Log in as the client admin (`abdrkdw21@gmail.com`) → confirm dashboard +
      leads load and a lead can be edited.
- [ ] Delete the test lead afterwards.

## 6. Hand off to the client 🧑

- [ ] Give the client: form URL `https://ien-crm.vercel.app/apply`, their login
      `abdrkdw21@gmail.com`, and `STAFF_GUIDE.md`.
- [ ] (Optional, later) point a custom domain (e.g. `apply.ienconsultancy…`) at
      Vercel so the link is branded.

---

**Branching rule now that a client depends on production:** `main` stays
always-deployable (it *is* the client's live form). All CRM development —
Phase C, Phase D — happens on feature branches with their own Vercel preview
URLs, and only merges to `main` after testing. Client-urgent tweaks get a short
branch off `main`, a preview check, then a fast merge.
