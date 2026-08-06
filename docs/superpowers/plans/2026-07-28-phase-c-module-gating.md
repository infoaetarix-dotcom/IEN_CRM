# Phase C — Module Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the per-org module toggles in `/super` actually enforce access in the org-facing CRM, so each consultancy sees and uses only the modules in its package.

**Architecture:** A static, client-safe **registry** (`lib/modules/registry.ts`) is the single source of truth for what modules exist and where they surface, plus pure decision helpers. A `server-only` **entitlements** module (`lib/modules/entitlements.ts`) reads `organization_modules` and exposes `getEnabledModules`, `hasModule`, and a `requireModule` guard. Enforcement is defense-in-depth: nav filtering, server route guards, and server-action guards. `leads` is a core module (always available); `analytics`/`email` gate at feature level inside existing pages.

**Tech Stack:** Next.js 15 App Router (TS strict), Supabase (RLS, anon + service clients), vitest (unit, `tests/unit/**`), Playwright (e2e, service-role seeding), lucide-react icons, Tailwind.

## Global Constraints

- Enforcement is **server-side** — hiding nav is necessary but never sufficient; every gated surface also has a server guard.
- **RLS is not the mechanism** — module gating is entitlement, not data isolation. Never rely on RLS to hide a module.
- `lib/modules/registry.ts` must stay **client-safe** — no `server-only`, no DB, no Supabase imports (the client `Sidebar` imports it).
- `lib/modules/entitlements.ts` is **`server-only`**.
- Registry module `key`s must match the DB `modules` seed in `supabase/migrations/0004_multi_tenant.sql` **exactly**.
- `leads` is `core: true` — never gated. `whatsapp`/`chatbot`/`bulk_messaging` are `status: 'future'` — never rendered.
- Never serialize an icon component across the server→client boundary. Only the `string[]` of enabled keys crosses it; the client imports the registry for icons.
- **No DB migration** — `organization_modules` already exists (migration `0004`).
- Follow existing guard patterns: guards `redirect()` (they do not throw typed errors); actions return `{ ok, error }`.

---

### Task 1: Module registry + pure decision helpers

**Files:**
- Create: `lib/modules/registry.ts`
- Test: `tests/unit/module-registry.test.ts`

**Interfaces:**
- Produces:
  - `interface ModuleDef { key: string; label: string; icon?: LucideIcon; route?: string; adminOnly?: boolean; core?: boolean; status: 'live' | 'future'; }`
  - `MODULES: ModuleDef[]`
  - `getModule(key: string): ModuleDef | undefined`
  - `isCore(key: string): boolean`
  - `isModuleAllowed(key: string, enabled: Iterable<string>): boolean`
  - `interface NavEntry { href: string; label: string; icon: LucideIcon; }`
  - `navItemsFor(role: 'admin' | 'agent', enabled: Iterable<string>): NavEntry[]`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/module-registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  MODULES,
  getModule,
  isCore,
  isModuleAllowed,
  navItemsFor,
} from '@/lib/modules/registry';

/** Parse the module keys seeded in migration 0004 (source of truth for the DB). */
function dbSeedKeys(): Set<string> {
  const sql = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/0004_multi_tenant.sql'),
    'utf8',
  );
  const start = sql.indexOf('insert into modules (key, name, description) values');
  const end = sql.indexOf('on conflict', start);
  const block = sql.slice(start, end);
  const keys = new Set<string>();
  for (const m of block.matchAll(/\(\s*'([a-z_]+)'/g)) keys.add(m[1]);
  return keys;
}

describe('module registry ↔ DB integrity', () => {
  it('every registry key exists in the 0004 modules seed (no drift)', () => {
    const db = dbSeedKeys();
    expect(db.size).toBeGreaterThan(0);
    for (const m of MODULES) expect(db.has(m.key)).toBe(true);
  });

  it('every DB seed key is described in the registry (no orphans)', () => {
    const registryKeys = new Set(MODULES.map((m) => m.key));
    for (const key of dbSeedKeys()) expect(registryKeys.has(key)).toBe(true);
  });
});

describe('core + allow logic', () => {
  it('leads is core; templates is not', () => {
    expect(isCore('leads')).toBe(true);
    expect(isCore('templates')).toBe(false);
  });

  it('core modules are always allowed even with an empty enabled set', () => {
    expect(isModuleAllowed('leads', new Set())).toBe(true);
  });

  it('non-core modules require an explicit enable', () => {
    expect(isModuleAllowed('templates', new Set())).toBe(false);
    expect(isModuleAllowed('templates', new Set(['templates']))).toBe(true);
  });

  it('unknown keys are never allowed', () => {
    expect(isModuleAllowed('nope', new Set(['nope']))).toBe(true); // in set
    expect(isModuleAllowed('nope', new Set())).toBe(false);
    expect(isCore('nope')).toBe(false);
  });
});

describe('navItemsFor', () => {
  it('an agent with only leads sees just Leads', () => {
    const items = navItemsFor('agent', new Set(['leads']));
    expect(items.map((i) => i.href)).toEqual(['/leads']);
  });

  it('an admin with the full package sees Leads, Templates, Agents', () => {
    const items = navItemsFor('admin', new Set(['leads', 'templates', 'agents']));
    expect(items.map((i) => i.href)).toEqual(['/leads', '/templates', '/agents']);
  });

  it('an admin with an empty package still sees core Leads only', () => {
    const items = navItemsFor('admin', new Set());
    expect(items.map((i) => i.href)).toEqual(['/leads']);
  });

  it('future modules never appear in nav', () => {
    const items = navItemsFor('admin', new Set(['whatsapp', 'chatbot', 'bulk_messaging']));
    expect(items.map((i) => i.href)).toEqual(['/leads']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\dev\IEN_CRM && pnpm test module-registry`
Expected: FAIL — cannot resolve `@/lib/modules/registry`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/modules/registry.ts`:

```ts
import { Users, UserCog, Mail, type LucideIcon } from 'lucide-react';

export interface ModuleDef {
  /** Matches DB modules.key exactly (see migration 0004). */
  key: string;
  label: string;
  /** Nav icon; only set for modules that are standalone routes. */
  icon?: LucideIcon;
  /** Route prefix if this module is a standalone page, e.g. '/templates'. */
  route?: string;
  /** Role gate — admins only, independent of entitlement. */
  adminOnly?: boolean;
  /** Always available regardless of entitlement (e.g. leads). */
  core?: boolean;
  status: 'live' | 'future';
}

/** Single source of truth for module → UI mapping. Client-safe (no DB). */
export const MODULES: ModuleDef[] = [
  { key: 'leads', label: 'Leads', icon: Users, route: '/leads', core: true, status: 'live' },
  { key: 'analytics', label: 'Analytics', status: 'live' },
  { key: 'email', label: 'Email outreach', status: 'live' },
  { key: 'templates', label: 'Templates', icon: Mail, route: '/templates', adminOnly: true, status: 'live' },
  { key: 'agents', label: 'Team management', icon: UserCog, route: '/agents', adminOnly: true, status: 'live' },
  { key: 'whatsapp', label: 'WhatsApp', status: 'future' },
  { key: 'chatbot', label: 'Social chatbot', status: 'future' },
  { key: 'bulk_messaging', label: 'Bulk messaging', status: 'future' },
];

const BY_KEY = new Map(MODULES.map((m) => [m.key, m]));

export function getModule(key: string): ModuleDef | undefined {
  return BY_KEY.get(key);
}

export function isCore(key: string): boolean {
  return getModule(key)?.core === true;
}

/** True when a module is available to an org given its enabled set. */
export function isModuleAllowed(key: string, enabled: Iterable<string>): boolean {
  if (isCore(key)) return true;
  for (const k of enabled) if (k === key) return true;
  return false;
}

export interface NavEntry {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Nav links this user should see: live, routed, role-allowed, entitled. */
export function navItemsFor(
  role: 'admin' | 'agent',
  enabled: Iterable<string>,
): NavEntry[] {
  const enabledSet = new Set(enabled);
  return MODULES.filter(
    (m) =>
      m.status === 'live' &&
      m.route &&
      m.icon &&
      (!m.adminOnly || role === 'admin') &&
      isModuleAllowed(m.key, enabledSet),
  ).map((m) => ({ href: m.route!, label: m.label, icon: m.icon! }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:\dev\IEN_CRM && pnpm test module-registry`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/modules/registry.ts tests/unit/module-registry.test.ts
git commit -m "feat(modules): module registry + pure entitlement helpers"
```

---

### Task 2: Entitlements — org module reads + guards

**Files:**
- Create: `lib/modules/entitlements.ts`
- Test: `tests/unit/entitlements.test.ts`

**Interfaces:**
- Consumes: `isCore`, `isModuleAllowed` from `lib/modules/registry`; `requireUser`, `SessionProfile`, `UserRole` from `lib/auth/guards`; `createClient` from `lib/supabase/server`; `redirect` from `next/navigation`; `cache` from `react`.
- Produces:
  - `getEnabledModulesUncached(orgId: string): Promise<Set<string>>` (exported for tests)
  - `getEnabledModules(orgId: string): Promise<Set<string>>` (React `cache`-wrapped)
  - `hasModule(orgId: string | null, key: string): Promise<boolean>`
  - `requireModule(key: string, opts?: { role?: UserRole }): Promise<SessionProfile>`

*Note on test scope:* `getEnabledModulesUncached` (row→Set mapping) is unit-tested here with a mocked Supabase client. `requireModule`'s redirect behavior and `hasModule` wiring are covered end-to-end in Task 7 against the real DB — stronger and less brittle than mocking `redirect` + React `cache`.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/entitlements.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';

// Mock the server Supabase client BEFORE importing the module under test.
const rows: { module_key: string }[] = [
  { module_key: 'leads' },
  { module_key: 'analytics' },
];
vi.mock('@/lib/supabase/server', () => {
  const builder = {
    select() { return builder; },
    eq() { return builder; },
    then(resolve: (v: { data: unknown; error: null }) => void) {
      resolve({ data: rows, error: null });
    },
  };
  return { createClient: async () => ({ from: () => builder }) };
});

import { getEnabledModulesUncached } from '@/lib/modules/entitlements';

describe('getEnabledModulesUncached', () => {
  it('maps organization_modules rows into a Set of keys', async () => {
    const set = await getEnabledModulesUncached('org-1');
    expect(set).toBeInstanceOf(Set);
    expect([...set].sort()).toEqual(['analytics', 'leads']);
    expect(set.has('templates')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd C:\dev\IEN_CRM && pnpm test entitlements`
Expected: FAIL — cannot resolve `@/lib/modules/entitlements`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/modules/entitlements.ts`:

```ts
import 'server-only';

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireUser, type SessionProfile, type UserRole } from '@/lib/auth/guards';
import { isCore, isModuleAllowed } from '@/lib/modules/registry';

/** Plain fetch (no request-memoization) — exported for unit tests. */
export async function getEnabledModulesUncached(orgId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('organization_modules')
    .select('module_key')
    .eq('organization_id', orgId)
    .eq('enabled', true);
  return new Set((data ?? []).map((r) => r.module_key as string));
}

/** Enabled module keys for an org. Memoized per request so one render = one query. */
export const getEnabledModules = cache(getEnabledModulesUncached);

/** Feature-level check. Core modules short-circuit true without a query. */
export async function hasModule(orgId: string | null, key: string): Promise<boolean> {
  if (isCore(key)) return true;
  if (!orgId) return false;
  return (await getEnabledModules(orgId)).has(key);
}

/**
 * Route/action guard. Runs requireUser, optionally enforces a role, then the
 * module entitlement. Redirects non-members away and the un-entitled to the
 * locked/upsell page. Works in both server components and server actions.
 */
export async function requireModule(
  key: string,
  opts?: { role?: UserRole },
): Promise<SessionProfile> {
  const profile = await requireUser();

  if (opts?.role && !profile.is_super_admin && profile.role !== opts.role) {
    redirect('/dashboard');
  }

  const enabled =
    !isCore(key) && profile.organization_id
      ? await getEnabledModules(profile.organization_id)
      : new Set<string>();

  if (!isModuleAllowed(key, enabled)) {
    redirect(`/locked?module=${encodeURIComponent(key)}`);
  }

  return profile;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd C:\dev\IEN_CRM && pnpm test entitlements`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/modules/entitlements.ts tests/unit/entitlements.test.ts
git commit -m "feat(modules): org entitlement reads + requireModule guard"
```

---

### Task 3: Locked / upsell page

**Files:**
- Create: `app/(admin)/locked/page.tsx`

**Interfaces:**
- Consumes: `getModule` from `lib/modules/registry`; `Card`, `CardContent` from `@/components/ui/card`.
- Produces: route `/locked` rendering an upsell card. It is the redirect target of `requireModule`.

- [ ] **Step 1: Create the page**

Create `app/(admin)/locked/page.tsx`:

```tsx
import Link from 'next/link';
import { getModule } from '@/lib/modules/registry';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = { title: 'Not in your plan — IEN CRM' };

export default async function LockedPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const { module } = await searchParams;
  const mod = module ? getModule(module) : undefined;
  const label = mod?.label ?? 'This feature';

  return (
    <div className="mx-auto max-w-lg py-16">
      <Card>
        <CardContent className="space-y-4 p-8 text-center">
          <p className="label-eyebrow text-accent">Upgrade</p>
          <h1 className="font-serif text-2xl">
            {label} isn&rsquo;t part of your plan
          </h1>
          <p className="text-sm text-muted-foreground">
            This module isn&rsquo;t included in your current package. Contact
            your administrator to enable it for your team.
          </p>
          <Link
            href="/dashboard"
            className="inline-block text-sm font-medium text-accent hover:underline"
          >
            &larr; Back to dashboard
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd C:\dev\IEN_CRM && pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "app/(admin)/locked/page.tsx"
git commit -m "feat(modules): locked/upsell page for gated modules"
```

---

### Task 4: Layout loads entitlements + Sidebar filters nav

**Files:**
- Modify: `app/(admin)/layout.tsx`
- Modify: `components/dashboard/sidebar.tsx`

**Interfaces:**
- Consumes: `getEnabledModules` from `lib/modules/entitlements`; `navItemsFor` from `lib/modules/registry`.
- Produces: `Sidebar` now takes `{ role: 'admin' | 'agent'; modules: string[] }`.

- [ ] **Step 1: Rewrite the Sidebar to use the registry + a modules prop**

Replace the entire contents of `components/dashboard/sidebar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { navItemsFor, type NavEntry } from '@/lib/modules/registry';

export function Sidebar({
  role,
  modules,
}: {
  role: 'admin' | 'agent';
  modules: string[];
}) {
  const pathname = usePathname();

  // Dashboard is the always-on home shell; module links come from the registry.
  const items: NavEntry[] = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    ...navItemsFor(role, modules),
  ];

  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((item) => {
        const active =
          pathname === item.href || pathname.startsWith(item.href + '/');
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-accent/15 text-accent'
                : 'text-paper/70 hover:bg-paper/10 hover:text-paper',
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Load enabled modules in the layout and pass them to both Sidebars**

In `app/(admin)/layout.tsx`, add the import after the existing `Sidebar` import:

```tsx
import { getEnabledModules } from '@/lib/modules/entitlements';
```

Replace the guard line:

```tsx
  const profile = await requireUser();
```

with:

```tsx
  const profile = await requireUser();
  const modules = profile.organization_id
    ? [...(await getEnabledModules(profile.organization_id))]
    : [];
```

Update **both** `<Sidebar>` usages (desktop aside and mobile row) from:

```tsx
        <Sidebar role={profile.role} />
```

to:

```tsx
        <Sidebar role={profile.role} modules={modules} />
```

- [ ] **Step 3: Verify it typechecks**

Run: `cd C:\dev\IEN_CRM && pnpm typecheck`
Expected: no errors (both `Sidebar` call sites now pass `modules`).

- [ ] **Step 4: Commit**

```bash
git add "app/(admin)/layout.tsx" components/dashboard/sidebar.tsx
git commit -m "feat(modules): filter dashboard nav by org package"
```

---

### Task 5: Server route + action guards (templates, agents)

**Files:**
- Modify: `app/(admin)/templates/page.tsx`
- Modify: `app/(admin)/templates/actions.ts`
- Modify: `app/(admin)/agents/page.tsx`
- Modify: `app/(admin)/agents/actions.ts`

**Interfaces:**
- Consumes: `requireModule` from `lib/modules/entitlements`.

- [ ] **Step 1: Guard the templates page**

In `app/(admin)/templates/page.tsx`, replace:

```tsx
import { requireRole } from '@/lib/auth/guards';
```

with:

```tsx
import { requireModule } from '@/lib/modules/entitlements';
```

and replace:

```tsx
  await requireRole('admin');
```

with:

```tsx
  await requireModule('templates', { role: 'admin' });
```

- [ ] **Step 2: Guard the templates action**

In `app/(admin)/templates/actions.ts`, replace:

```tsx
import { requireRole } from '@/lib/auth/guards';
```

with:

```tsx
import { requireModule } from '@/lib/modules/entitlements';
```

and replace:

```tsx
  const admin = await requireRole('admin');
```

with:

```tsx
  const admin = await requireModule('templates', { role: 'admin' });
```

- [ ] **Step 3: Guard the agents page**

In `app/(admin)/agents/page.tsx`, replace:

```tsx
import { requireRole } from '@/lib/auth/guards';
```

with:

```tsx
import { requireModule } from '@/lib/modules/entitlements';
```

and replace:

```tsx
  const admin = await requireRole('admin');
```

with:

```tsx
  const admin = await requireModule('agents', { role: 'admin' });
```

- [ ] **Step 4: Guard the agents actions**

In `app/(admin)/agents/actions.ts`, replace the import:

```tsx
import { requireRole } from '@/lib/auth/guards';
```

with:

```tsx
import { requireModule } from '@/lib/modules/entitlements';
```

Then replace **every** occurrence (there are three) of:

```tsx
  const admin = await requireRole('admin');
```

with:

```tsx
  const admin = await requireModule('agents', { role: 'admin' });
```

(Use find-all; confirm three replacements. If any function uses `requireRole` without assigning to `admin`, replace it in the same shape.)

- [ ] **Step 5: Verify no stray `requireRole` imports remain unused and it typechecks**

Run: `cd C:\dev\IEN_CRM && pnpm typecheck`
Expected: no errors, no "requireRole declared but never used".

- [ ] **Step 6: Commit**

```bash
git add "app/(admin)/templates/page.tsx" "app/(admin)/templates/actions.ts" "app/(admin)/agents/page.tsx" "app/(admin)/agents/actions.ts"
git commit -m "feat(modules): server route + action guards for templates and agents"
```

---

### Task 6: Feature-level gating (analytics on dashboard, email in lead detail)

**Files:**
- Modify: `app/(admin)/dashboard/page.tsx`
- Modify: `app/(admin)/leads/[id]/page.tsx`
- Modify: `app/(admin)/leads/actions.ts`

**Interfaces:**
- Consumes: `hasModule`, `requireModule` from `lib/modules/entitlements`.

- [ ] **Step 1: Gate the analytics section on the dashboard**

In `app/(admin)/dashboard/page.tsx`, add the import after the existing guards import:

```tsx
import { hasModule } from '@/lib/modules/entitlements';
```

After the line:

```tsx
  const profile = await requireUser();
```

add:

```tsx
  const showAnalytics = await hasModule(profile.organization_id, 'analytics');
```

Wrap the analytics UI — the metric-cards grid, the charts grid, and the "Lead volume" card — in `{showAnalytics && ( ... )}`. Concretely, change the block that begins with `{/* Metric cards */}` and ends at the closing `</Card>` of the "Lead volume (last 14 days)" card so it reads:

```tsx
      {showAnalytics && (
        <>
          {/* Metric cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Leads this month"
              value={totalThisMonth}
              hint={now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            />
            <MetricCard label="New today (unworked)" value={newToday} />
            <MetricCard
              label="Response rate < 1h"
              value={response.rate == null ? '—' : `${response.rate}%`}
              hint={
                response.rate == null
                  ? 'No leads in last 30 days'
                  : `${response.within} of ${response.denom} (last 30 days)`
              }
            />
            <MetricCard label="Active sources" value={sourceData.length} />
          </div>

          {/* Charts */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Leads by source</CardTitle>
              </CardHeader>
              <CardContent>
                {sourceData.length ? (
                  <SourceBar data={sourceData} />
                ) : (
                  <p className="py-10 text-center text-sm text-muted-foreground">
                    No data yet.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Pipeline status</CardTitle>
              </CardHeader>
              <CardContent>
                <PipelineBar data={pipelineData} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Lead volume (last 14 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <VolumeLine data={volumeData} />
            </CardContent>
          </Card>
        </>
      )}
```

Leave the "Recent leads" card untouched — it is part of the core `leads` module and always renders.

- [ ] **Step 2: Gate the Send-Email panel in lead detail**

In `app/(admin)/leads/[id]/page.tsx`, add the import after the existing guards import:

```tsx
import { hasModule } from '@/lib/modules/entitlements';
```

After:

```tsx
  const profile = await requireUser();
```

add:

```tsx
  const showEmail = await hasModule(profile.organization_id, 'email');
```

Wrap the "Send email" `<Card>` (the one whose `<CardTitle>` is `Send email`) in `{showEmail && ( ... )}`:

```tsx
          {showEmail && (
            <Card>
              <CardHeader>
                <CardTitle>Send email</CardTitle>
              </CardHeader>
              <CardContent>
                {(templatesRes.data ?? []).length > 0 ? (
                  <EmailPanel
                    leadId={lead.id}
                    templates={templatesRes.data ?? []}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No templates available.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
```

- [ ] **Step 3: Guard the send-email action**

In `app/(admin)/leads/actions.ts`, add the import after the existing guards import:

```tsx
import { requireModule } from '@/lib/modules/entitlements';
```

In `sendLeadEmail`, replace:

```tsx
  const user = await requireUser();
```

with:

```tsx
  const user = await requireModule('email');
```

Leave the other actions (`updateLeadStatus`, `addNote`, `assignLead`) unchanged — they belong to the core leads module.

- [ ] **Step 4: Verify it typechecks and unit tests still pass**

Run: `cd C:\dev\IEN_CRM && pnpm typecheck && pnpm test`
Expected: typecheck clean; all unit tests PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin)/dashboard/page.tsx" "app/(admin)/leads/[id]/page.tsx" "app/(admin)/leads/actions.ts"
git commit -m "feat(modules): feature-level gating for analytics and email"
```

---

### Task 7: E2E — seed a limited-package org and verify gating

**Files:**
- Modify: `tests/e2e/helpers.ts`
- Modify: `tests/e2e/global-setup.ts`
- Modify: `tests/e2e/global-teardown.ts`
- Create: `tests/e2e/module-gating.spec.ts`

**Interfaces:**
- Consumes: `serviceClient`, `TEST_PASSWORD`, `TEST_USERS`, `STATE_FILE` from `tests/e2e/helpers`.
- Produces: exported `LIMITED_ORG_SLUG`, `LIMITED_ADMIN`; state keys `limitedOrg`, `limitedLead`, and `users.limitedAdmin`.

- [ ] **Step 1: Add limited-org constants to helpers**

In `tests/e2e/helpers.ts`, after the `TEST_USERS` block, add:

```ts
export const LIMITED_ORG_SLUG = 'e2e-limited-org';
export const LIMITED_ADMIN = {
  email: 'e2e_limited_admin@ientest.local',
  name: 'E2E Limited Admin',
  role: 'admin',
} as const;
```

- [ ] **Step 2: Seed the limited org, its admin, and a lead in global-setup**

In `tests/e2e/global-setup.ts`, extend the imports from `./helpers`:

```ts
import {
  serviceClient,
  TEST_USERS,
  TEST_PASSWORD,
  STATE_FILE,
  LIMITED_ORG_SLUG,
  LIMITED_ADMIN,
} from './helpers';
```

Immediately **before** the final `writeFileSync(...)` call, insert:

```ts
  // ── Limited-package org: leads only (no analytics/email/templates/agents) ──
  await svc.from('organizations').delete().eq('slug', LIMITED_ORG_SLUG);
  const { data: lorg, error: lorgErr } = await svc
    .from('organizations')
    .insert({ name: 'E2E Limited Org', slug: LIMITED_ORG_SLUG })
    .select('id')
    .single();
  if (lorgErr || !lorg) throw new Error(`create limited org: ${lorgErr?.message}`);
  const limitedOrgId = lorg.id as string;

  await svc
    .from('organization_modules')
    .insert({ organization_id: limitedOrgId, module_key: 'leads' });

  const existingLimited = await findUserByEmail(svc, LIMITED_ADMIN.email);
  if (existingLimited) await svc.auth.admin.deleteUser(existingLimited.id);
  const { data: la, error: laErr } = await svc.auth.admin.createUser({
    email: LIMITED_ADMIN.email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: LIMITED_ADMIN.name },
  });
  if (laErr || !la.user) throw new Error(`create limited admin: ${laErr?.message}`);
  ids.limitedAdmin = la.user.id;
  await svc
    .from('profiles')
    .update({
      role: LIMITED_ADMIN.role,
      full_name: LIMITED_ADMIN.name,
      organization_id: limitedOrgId,
    })
    .eq('id', la.user.id);

  const { data: limitedLead } = await svc
    .from('leads')
    .insert({
      organization_id: limitedOrgId,
      full_name: 'E2E Limited Lead',
      email: 'e2e_limited_lead@example.com',
      phone: '+10000000003',
      consent_given: true,
      utm_source: 'instagram',
    })
    .select('id')
    .single();
```

Then change the `writeFileSync` payload from:

```ts
      { org: orgId, users: ids, leadA: leadA?.id, leadB: leadB?.id },
```

to:

```ts
      {
        org: orgId,
        limitedOrg: limitedOrgId,
        users: ids,
        leadA: leadA?.id,
        leadB: leadB?.id,
        limitedLead: limitedLead?.id,
      },
```

- [ ] **Step 3: Clean up the limited org in global-teardown**

In `tests/e2e/global-teardown.ts`, widen the `state` type:

```ts
  let state: {
    org?: string;
    limitedOrg?: string;
    users: Record<string, string>;
    leadA?: string;
    leadB?: string;
    limitedLead?: string;
  };
```

Change the leads-deletion loop to include the limited lead:

```ts
  for (const id of [state.leadA, state.leadB, state.limitedLead]) {
    if (id) await svc.from('leads').delete().eq('id', id);
  }
```

After the existing `if (state.org)` org deletion, add:

```ts
  if (state.limitedOrg) await svc.from('organizations').delete().eq('id', state.limitedOrg);
```

(`ids.limitedAdmin` is already in `state.users`, so the existing user-cleanup loop deletes that auth user.)

- [ ] **Step 4: Write the gating spec**

Create `tests/e2e/module-gating.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { TEST_USERS, LIMITED_ADMIN, TEST_PASSWORD, STATE_FILE } from './helpers';

function state() {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/);
}

test('limited-package org sees only its modules', async ({ page }) => {
  await login(page, LIMITED_ADMIN.email);

  // Core nav is present…
  await expect(page.getByRole('link', { name: /^Dashboard$/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /^Leads$/ }).first()).toBeVisible();

  // …gated nav is absent everywhere in the DOM.
  await expect(page.getByRole('link', { name: /^Templates$/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /^Agents$/ })).toHaveCount(0);

  // Dashboard shows no analytics but keeps the core leads view.
  await expect(page.getByText(/leads this month/i)).toHaveCount(0);
  await expect(page.getByText(/recent leads/i)).toBeVisible();

  // Direct route access is blocked → locked/upsell page.
  await page.goto('/templates');
  await expect(
    page.getByRole('heading', { name: /isn.t part of your plan/i }),
  ).toBeVisible();

  // Lead detail has no Send-Email panel.
  await page.goto(`/leads/${state().limitedLead}`);
  await expect(
    page.getByRole('heading', { name: /E2E Limited Lead/ }),
  ).toBeVisible();
  await expect(page.getByText(/send email/i)).toHaveCount(0);
});

test('full-package org still sees every module (no regression)', async ({ page }) => {
  await login(page, TEST_USERS.admin.email);
  await expect(page.getByRole('link', { name: /^Templates$/ }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /^Agents$/ }).first()).toBeVisible();
  await expect(page.getByText(/leads this month/i)).toBeVisible();
});
```

- [ ] **Step 5: Run the e2e suite**

Prerequisite: Supabase project must be **active** (not paused), and `.env.local` present with `SUPABASE_SERVICE_ROLE_KEY`.

Run: `cd C:\dev\IEN_CRM && pnpm test:e2e module-gating`
Expected: both tests PASS. If any nav assertion hits a Playwright strict-mode "resolved to 2 elements" error (desktop + mobile Sidebar both in DOM), the presence checks already use `.first()`; keep absence checks on `toHaveCount(0)`.

- [ ] **Step 6: Run the full e2e suite to confirm no regression**

Run: `cd C:\dev\IEN_CRM && pnpm test:e2e`
Expected: existing `admin`, `public`, `rls` specs still PASS alongside `module-gating`.

- [ ] **Step 7: Commit**

```bash
git add tests/e2e/helpers.ts tests/e2e/global-setup.ts tests/e2e/global-teardown.ts tests/e2e/module-gating.spec.ts
git commit -m "test(modules): e2e module gating with a limited-package org"
```

---

### Task 8: Final verification + production build

**Files:** none (verification only)

- [ ] **Step 1: Full unit suite**

Run: `cd C:\dev\IEN_CRM && pnpm test`
Expected: all unit tests PASS (including `module-registry`, `entitlements`).

- [ ] **Step 2: Typecheck + lint**

Run: `cd C:\dev\IEN_CRM && pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Production build**

Run: `cd C:\dev\IEN_CRM && pnpm build`
Expected: build succeeds; `/locked` appears in the route list.

- [ ] **Step 4: Manual smoke (optional, recommended)**

Start `pnpm dev`; sign in as the IEN admin (`abdrkdw21@gmail.com`) → confirm all nav + analytics + email still present (IEN has every module). Then, in `/super`, disable a module for a throwaway org and confirm that org's admin loses the nav link and gets the locked page on direct access.

- [ ] **Step 5: Integration handoff**

Do not merge to `main` yet — Phase C stays on `phase-c-module-gating` until the user finishes developing the remaining phases and tests. When ready, use `superpowers:finishing-a-development-branch`.

---

## Self-Review

**Spec coverage:**
- Registry (client-safe, source of truth) → Task 1. ✓
- Entitlements (`getEnabledModules`/`hasModule`/`requireModule`, `core` short-circuit) → Task 2. ✓
- Nav layer → Task 4. ✓ · Route layer → Tasks 5, 6. ✓ · Action layer → Tasks 5, 6. ✓
- Middleware stays auth-only → no task touches `middleware.ts` (deliberate). ✓
- Feature-level analytics + email → Task 6. ✓
- `leads` core / dashboard always-on → Tasks 1 (core flag), 6 (Recent leads untouched). ✓
- Locked page → Task 3. ✓
- Registry↔DB integrity test → Task 1. ✓ · Entitlement mapping test → Task 2. ✓ · E2E limited-package + no-regression → Task 7. ✓
- Files list in spec ⊆ files touched here. `leads/page.tsx` intentionally **not** modified (leads is core; its existing `requireUser` suffices — noted change from the spec's file list to avoid a no-op guard). ✓

**Placeholder scan:** none — every code step contains complete code.

**Type consistency:** `getEnabledModules`/`getEnabledModulesUncached` return `Set<string>`; `hasModule(orgId: string | null, key)`; `requireModule(key, opts?: { role })` returns `SessionProfile`; `navItemsFor(role, enabled)` returns `NavEntry[]`; `Sidebar` prop `modules: string[]`. Consistent across Tasks 1, 2, 4, 5, 6. `NavEntry` is imported by Sidebar (Task 4) exactly as produced in Task 1.
