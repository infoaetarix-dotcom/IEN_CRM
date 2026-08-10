# Tweaks & Iteration Log

Running list of changes during the polish phase. Status: ⬜ todo · 🔄 in progress · ✅ done · 🚫 won't do.
Priority: 🔴 must-fix-before-launch · 🟡 nice-to-have · 🟢 minor.

How we work: you test on localhost:3000 / ien-crm.vercel.app and report issues here; I implement, mark ✅, and push (auto-deploys to Vercel). Each batch = one commit.

---

## Active — Batch 1: Public form (/apply) overhaul

Requested by client — ✅ implemented, awaiting your visual check on localhost before push:
| # | Status | Pri | Change | Notes |
|---|--------|-----|--------|-------|
| 1 | ✅ | 🟡 | **Email** — `you@example.com` placeholder + validation | |
| 2 | ✅ | 🔴 | **Phone** — international input, country dropdown w/ flags + per-country length validation | inline SVG flags (CSP-safe); stores E.164; rejected fake `+44 7700 900123` correctly |
| 3 | ✅ | 🔴 | **DOB** — click → calendar popover w/ month+year dropdowns (jump decades) | range 1925–today |
| 4 | ✅ | 🟡 | **Target country** — full searchable country list with SVG flags | replaces short list + Other |
| 5 | ✅ | 🟡 | **Highest education** — "Other" reveals custom text box | |
| 6 | ✅ | 🟡 | **Program** — Degree dropdown (MSc/BSc/MBA/PhD…) + Field of study text → combined | |
| 7 | ✅ | 🟢 | Preferred institution — left as-is (marked optional) | |

Verify on **localhost:3000/apply**. typecheck ✓ · 21 unit tests ✓ · compiles clean. Not yet pushed.

Round 2 (from testing):
| # | Status | Pri | Change | Notes |
|---|--------|-----|--------|-------|
| 8 | ✅ | 🟡 | **Email** inline validation on blur (flags missing @) | mirrors phone UX |
| 9 | ✅ | 🟡 | **DOB calendar** redesigned — clean caption: ‹ [Month▾] [Year▾] › + tidy grid | was cluttered/duplicated labels |
| 0c | ✅ | – | (Earlier bugs from CSP-eval fix: country dropdown, education "Other", calendar open — all now work) | |

Reminder for client: add **`localhost`** back alongside `ien-crm.vercel.app` in the Turnstile hostnames so the form's bot-check works locally too (multiple hostnames allowed on one widget).

My professional recommendations (need your yes/no):
| # | Status | Pri | Suggestion | Why |
|---|--------|-----|-----------|-----|
| S1 | ⬜ | 🔴 | Real **privacy-policy URL** behind the consent checkbox | Consent isn't legally valid without it; required for UK/EU PII |
| S2 | ⬜ | 🟡 | Split consent: required "process my data to contact me" + optional "send me marketing" | GDPR best practice; cleaner lawful basis |
| S3 | ⬜ | 🟡 | Add "Intended intake" (e.g. Sep 2026 / Jan 2027) | Standard study-abroad qualifier; helps agents prioritise |
| S4 | ⬜ | 🟡 | Duplicate-email handling (same person re-submits) | Today it creates a duplicate lead; could flag/merge |
| S5 | 🔄 | 🟢 | Inline validation on blur (red borders + messages), not just on submit | Pro UX; building it into the overhaul |
| S6 | ⬜ | 🟢 | "Is this number on WhatsApp?" toggle | WhatsApp is a key channel for this client |

## Active — Batch 2: Extended intake fields + schema (industry-grade)

⚠️ **REQUIRES DB MIGRATION** — run `supabase/migrations/0002_extended_lead_fields.sql` in the Supabase SQL editor before submitting the form (adds the new columns). One Supabase DB serves both local + prod, so running it once covers both.

| Status | Change | Notes |
|--------|--------|-------|
| ✅ | Split "Study goals" → **Prior education & experience** + **Study goals** | as requested |
| ✅ | About you: **+ City, District** | text |
| ✅ | Highest education: **+ Matric/O-Levels, Intermediate/A-Levels** | |
| ✅ | Prior education: qualification, institution attended, passing year, **grading system (CGPA/4, CGPA/5, %) + result** | solves GPA-scale ambiguity |
| ✅ | **Work experience** (years + role) | |
| ✅ | **English proficiency** (IELTS/TOEFL/PTE/Duolingo/planned/none + score) | score field shows only for real tests |
| ✅ | **Intended intake** (season + year) | |
| ✅ | **Funding source** (self/family/loan/scholarship/employer/other) | |
| ✅ | All categorical fields = dropdowns w/ fixed codes + **DB CHECK constraints** | standardized for analytics; DB-enforced |
| ✅ | Lead detail page shows all new fields (3 cards: Contact&location / Prior education / Study goals) | |

Security: new fields are columns on `leads` → inherit existing RLS (agents see only assigned), server-side Zod validation + DB CHECK constraints (defense in depth), plain-text escaped rendering. No new sensitive identifiers (no passport #, no bank details). typecheck ✓ · 22 tests ✓ · compiles ✓. Not pushed.

| ✅ | **Required fields** (round 1): name, email, phone, DOB, consent + Target country + Highest education | |
| ✅ | **Required fields** (round 2): + City, Last qualification, Institution attended, Passing year, Grading system, Result | About-you complete except District; Prior-education complete except work experience |
| — | Work experience kept OPTIONAL (flagged): most applicants are fresh students; forcing it blocks them / creates junk. Client to confirm. | |

## Done

| # | Change | Commit |
|---|--------|--------|
| 0 | Fix: ESM import for tailwindcss-animate (dev server crash) | 2f1aedc (local, unpushed) |
| 0b | Fix: allow `unsafe-eval` in CSP **dev-only** (Next Fast Refresh needs it; prod stays strict). Was breaking ALL client interactivity in dev — calendar/country/education/Turnstile. | local, unpushed |

---

## Notes / decisions
- Local dev runs from `C:\dev\IEN_CRM` (moved off OneDrive for speed).
- Auto-deploy: push to `main` → live on ien-crm.vercel.app in ~1 min.
- Test data: 17 leads, all `@example.com` (deletable in one query when done).
- Open pre-launch items (from PROJECT_GUIDE §10): real privacy-policy URL, secret rotation, Brevo domain SPF/DKIM.
