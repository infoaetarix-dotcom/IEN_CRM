-- ============================================================
-- 0025_student_finance.sql — Student Finance module (shared team ledger)
-- ------------------------------------------------------------
-- Adds "Student Finance" to the module catalog (opt-in, off by default) and
-- the student_finance_entries table.
--
-- Deliberately the OPPOSITE visibility model from finance_entries (0019):
-- that one is a private per-admin ledger agents never see; this one is a
-- shared, org-wide ledger every active admin AND agent can read/write —
-- same "shared-data model" already used for leads/applications (any active
-- org member can touch any row in their org). Every entry must be linked to
-- a lead (lead_id is NOT NULL here, unlike finance_entries' optional link) —
-- the whole point of this ledger is tracking money tied to a specific
-- student, e.g. fees/deposits received.
--
-- SAFE ON A LIVE TABLE: purely additive. No existing org has this module
-- enabled, so nothing changes until a Super Admin opts an org in.
-- ============================================================

insert into modules (key, name, description) values
  ('student_finance', 'Student Finance', 'Shared team ledger of payments tied to a student — visible to every admin and agent')
on conflict (key) do nothing;

create table if not exists student_finance_entries (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  lead_id         uuid not null references leads(id) on delete cascade,
  type            text not null check (type in ('income', 'expense')),
  amount          numeric(12,2) not null check (amount > 0),
  category        text not null,
  payment_method  text,
  note            text,
  entry_date      date not null default current_date,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_student_finance_org_date
  on student_finance_entries (organization_id, entry_date desc);
create index if not exists idx_student_finance_lead
  on student_finance_entries (lead_id);

create trigger trg_student_finance_entries_touch
  before update on student_finance_entries
  for each row execute function public.touch_updated_at();

alter table student_finance_entries enable row level security;

-- Shared within the org — any active admin or agent may read/write any row,
-- same rule as leads_all/applications_all. No user_id-based restriction:
-- that's the entire point of this table vs. finance_entries.
drop policy if exists student_finance_entries_all on student_finance_entries;
create policy student_finance_entries_all on student_finance_entries for all
  using (
    public.is_super_admin()
    or organization_id = public.current_org()
  )
  with check (
    public.is_super_admin()
    or organization_id = public.current_org()
  );

grant select, insert, update, delete on student_finance_entries to authenticated;
grant all on student_finance_entries to service_role;

notify pgrst, 'reload schema';
