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
