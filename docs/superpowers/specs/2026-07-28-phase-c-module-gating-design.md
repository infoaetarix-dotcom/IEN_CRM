# Phase C — Module Gating (design spec)

**Date:** 2026-07-28
**Branch:** `phase-c-module-gating`
**Status:** Approved design → implementation

## Goal

Make the per-org module toggles in the `/super` platform console **actually enforce access** in the org-facing CRM app. Today `organization_modules` (per-org on/off flags) is written and displayed only in `/super`; the org app (`app/(admin)/*`) never reads it, so the toggles are cosmetic. Phase C closes that gap so each consultancy sees and can use **only the modules in its package**.

This is an entitlement/packaging concern for a billing-backed SaaS, so enforcement must be **server-side and defense-in-depth**, not merely hiding nav links.

## Non-goals (YAGNI)

- No named package presets (Starter/Pro/etc.). Per-module toggles in `/super` already express any custom package. Presets can come later.
- No new modules or new feature surfaces. `whatsapp`/`chatbot`/`bulk_messaging` remain future stubs with no routes.
- No middleware-level module checks (deliberate — see Enforcement).
- No changes to org data isolation (RLS already handles that).

## Key decisions

- **Blocked-access UX:** friendly upsell/"not included in your plan" page (doubles as an upsell surface), reached via server redirect. Nav link is simply absent.
- **Granularity:** feature-level. Two modules are not standalone routes — `analytics` = the metric cards/charts on the dashboard; `email` = the send-email feature inside lead detail. Both gate at their real feature boundary.
- **Dashboard is the always-available home shell** — never gated, guaranteeing a valid post-login landing regardless of package.
- **RLS is not the mechanism.** RLS enforces *org data isolation* (a lead belongs to org X). Module gating is *entitlement* (org X paid for the leads module). Enforced in app code.

## Architecture

Two well-bounded units:

### `lib/modules/registry.ts` — module descriptors (client-safe)

The single source of truth for **what modules exist and where they surface in the UI**. A static array; no DB, no `server-only` (the client `Sidebar` imports it). One entry per module:

```ts
interface ModuleDef {
  key: string;            // matches DB modules.key exactly
  label: string;          // nav / display label
  icon: LucideIcon;       // nav icon (lucide-react)
  route?: string;         // route prefix if it's a standalone page, e.g. '/templates'
  adminOnly?: boolean;    // role gate (admins only), independent of entitlement
  status: 'live' | 'future';
}
```

Live entries and their surfaces:

| key | label | route | adminOnly | notes |
|---|---|---|---|---|
| `leads` | Leads | `/leads` | no | core lead table + detail |
| `analytics` | Analytics | — | no | dashboard metric cards/charts (feature-level) |
| `email` | Email outreach | — | no | send-email feature in lead detail (feature-level) |
| `templates` | Templates | `/templates` | yes | email templates |
| `agents` | Team management | `/agents` | yes | staff/agents |

`whatsapp`, `chatbot`, `bulk_messaging` → `status:'future'`, no `route`, no nav. Never render until they have real surfaces; still toggleable in `/super`.

Only entries with a `route` become nav links; `analytics`/`email` have no `route` and are gated inline where they surface.

### `lib/modules/entitlements.ts` — runtime entitlement + guards (`server-only`)

Wraps `organization_modules`:

- `getEnabledModules(orgId: string): Promise<Set<string>>` — selects `module_key` where `enabled = true` for the org. Wrapped in React `cache()` so one render performs at most one query.
- `hasModule(orgId: string, key: string): Promise<boolean>` — convenience for feature-level checks inside pages.
- `requireModule(key: string): Promise<SessionProfile>` — guard: calls `requireUser()`, resolves the user's `organization_id`, and if the module isn't enabled, `redirect('/locked?module=<key>')`. Returns the profile on success. Works in both server components and server actions (Next handles the redirect throw in both).

Edge cases:
- A user with `organization_id = null` inside the org app (should not happen — super admins are routed to `/super`): treated as having no modules; `requireModule` redirects to locked. Non-fatal.
- Unknown/`future` keys passed to `requireModule` never appear in enabled set → redirect. Acceptable.

## Enforcement — three layers (defense-in-depth)

| Layer | Where | Mechanism |
|---|---|---|
| **Nav** | `components/dashboard/sidebar.tsx` | Client component imports the registry; filters items by `role` **and** the `enabledModules: string[]` prop passed from `app/(admin)/layout.tsx`. Disabled module → link absent. Icons stay client-side (never serialized across the server/client boundary — only the string[] of keys crosses it). |
| **Route** | each gated page | `await requireModule('<key>')` at the top of `leads/page.tsx`, `templates/page.tsx`, `agents/page.tsx`. Server-side redirect on miss → blocks direct URL access even if nav is bypassed. |
| **Action** | each gated server action | `await requireModule('<key>')` at the top of `templates/actions.ts` (template CRUD → `templates`), `agents/actions.ts` (agent CRUD → `agents`), and the send-email action in `leads/actions.ts` (→ `email`). Blocks direct POST even with nav hidden. |

`app/(admin)/layout.tsx` computes the enabled-module list once (via `getEnabledModules`, using the profile from `requireUser`) and passes `enabledModules={[...set]}` to `<Sidebar>`.

**Middleware stays auth-only** (`middleware.ts` unchanged for gating): module checks would require a DB query on every request, and server components/actions already enforce entitlement securely. Documented as a deliberate trade-off.

## Feature-level gating

- **`app/(admin)/dashboard/page.tsx`** — never calls `requireModule` (home shell). Wraps the analytics section (metric cards + charts) in `hasModule(org, 'analytics')`. When off, renders a lean view (welcome + basic leads count / quick links to enabled modules) instead of charts.
- **`app/(admin)/leads/[id]/page.tsx`** — renders the Send-Email panel only when `hasModule(org, 'email')`.
- **`leads/actions.ts` send-email action** — `await requireModule('email')` before sending.

## Locked page

`app/(admin)/locked/page.tsx` — server component under the admin layout (so the shell/nav still render). Reads `searchParams.module`, looks the label up in the registry, and renders a branded "**\<Module\> isn't part of your plan** — contact your admin to enable it" card with the upsell framing. No entitlement guard on this page itself (it's the fallback).

## Testing

**Unit (vitest):**
- `getEnabledModules` returns exactly the enabled keys for an org (mock Supabase).
- `requireModule` redirects to `/locked?module=X` when the module is absent; returns the profile when present.
- **Registry↔DB integrity:** every `registry` key exists in the `0004` `modules` seed, and every non-future concern is covered — no orphan keys in either direction (guards against drift between code and DB).

**E2E (Playwright):**
- Seed a **limited-package org** (leads-only) + its admin. Assert: Templates and Agents nav links absent; direct GET `/templates` lands on the locked page; dashboard shows no analytics charts; lead detail shows no Send-Email button.
- Existing full-package org (IEN) still sees all nav + surfaces — **no regression**.

## Files

**New**
- `lib/modules/registry.ts`
- `lib/modules/entitlements.ts`
- `app/(admin)/locked/page.tsx`

**Changed**
- `app/(admin)/layout.tsx` — load enabled modules, pass to `Sidebar`
- `components/dashboard/sidebar.tsx` — import registry, filter by role + modules prop
- `app/(admin)/leads/page.tsx` — `requireModule('leads')`
- `app/(admin)/templates/page.tsx` + `templates/actions.ts` — route + action guard (`templates`)
- `app/(admin)/agents/page.tsx` + `agents/actions.ts` — route + action guard (`agents`)
- `app/(admin)/dashboard/page.tsx` — analytics feature gate
- `app/(admin)/leads/[id]/page.tsx` — email feature gate
- `app/(admin)/leads/actions.ts` — send-email action guard (`email`)

## Rollout

- Feature branch `phase-c-module-gating`; keep `main` deployable.
- No DB migration required — `organization_modules` already exists (migration `0004`). IEN has all modules enabled (backfill), so its experience is unchanged.
- After merge + Vercel deploy, verify: IEN admin still sees everything; a test limited-package org sees only its modules.
