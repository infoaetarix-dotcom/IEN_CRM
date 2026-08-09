-- ============================================================
-- 0019_finance.sql — Finance module (per-admin private ledger)
-- ------------------------------------------------------------
-- Adds "Finance Management" to the module catalog (opt-in, off by default —
-- NOT in DEFAULT_MODULES, so it only appears once a Super Admin checks it
-- at registration or in Package — modules) and the finance_entries table.
--
-- Deliberately NOT scoped like every other tenant table (org-wide, admin
-- sees all). Each entry belongs to exactly one admin — RLS enforces that an
-- admin can only ever see/write their own rows, never another admin's, and
-- agents cannot see any of it. This is intentional: each admin's ledger
-- represents their own office/branch, kept private from other admins.
--
-- Owner-level cross-admin visibility (when that role exists) is a pure
-- additive RLS policy later — no migration of these rows will ever be
-- needed, because organization_id + user_id already correctly attribute
-- every row from day one.
--
-- SAFE ON A LIVE TABLE: purely additive. No existing org has this module
-- enabled, so nothing changes until a Super Admin opts an org in.
-- ============================================================

insert into modules (key, name, description) values
  ('finance', 'Finance Management', 'Private income/expense ledger — admin only, one ledger per admin')
on conflict (key) do nothing;

create table if not exists finance_entries (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  type            text not null check (type in ('income', 'expense')),
  amount          numeric(12,2) not null check (amount > 0),
  category        text not null,
  payment_method  text,
  note            text,
  lead_id         uuid references leads(id) on delete set null,
  entry_date      date not null default current_date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_finance_entries_org_user_date
  on finance_entries (organization_id, user_id, entry_date desc);

create trigger trg_finance_entries_touch
  before update on finance_entries
  for each row execute function public.touch_updated_at();

alter table finance_entries enable row level security;

-- Own rows only — organization_id scoping is the tenant backstop,
-- user_id scoping is what makes each admin's ledger private. is_admin()
-- excludes agents explicitly, even though they'll never see the nav item.
drop policy if exists finance_entries_own on finance_entries;
create policy finance_entries_own on finance_entries for all
  using (
    organization_id = public.current_org()
    and user_id = auth.uid()
    and public.is_admin()
  )
  with check (
    organization_id = public.current_org()
    and user_id = auth.uid()
    and public.is_admin()
  );

grant select, insert, update, delete on finance_entries to authenticated;
grant all on finance_entries to service_role;

notify pgrst, 'reload schema';
