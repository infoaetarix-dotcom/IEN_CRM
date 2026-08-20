-- ============================================================
-- 0027_universities.sql — org-managed university list + application link
-- ------------------------------------------------------------
-- Adds the `universities` table (Settings > Universities — each consultancy
-- maintains its own list) and links applications to it, replacing the old
-- free-text `institution` field on applications going forward (leads keep
-- their own free-text `institution` unchanged — that's the applicant's own
-- loose pre-application preference, deliberately not touched here).
--
-- Shared-data model, same as leads/applications/student_finance_entries: any
-- active admin or agent in the org can read/write. Not gated behind an
-- opt-in module — this is foundational reference data, not a premium add-on.
--
-- university_id on applications is nullable at the DB level (existing rows
-- have no university and can't be backfilled automatically — there's no
-- reliable way to match old free-text institution values to real rows) even
-- though the app requires it going forward for every *new* application.
--
-- SAFE ON A LIVE TABLE: purely additive — a new table plus a new nullable
-- column. No existing row or query is affected until the app starts using it.
-- ============================================================

create table if not exists universities (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null,
  country         text not null,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_universities_org on universities (organization_id, name);

create trigger trg_universities_touch
  before update on universities
  for each row execute function public.touch_updated_at();

alter table universities enable row level security;

drop policy if exists universities_all on universities;
create policy universities_all on universities for all
  using (
    public.is_super_admin()
    or organization_id = public.current_org()
  )
  with check (
    public.is_super_admin()
    or organization_id = public.current_org()
  );

grant select, insert, update, delete on universities to authenticated;
grant all on universities to service_role;

alter table applications
  add column if not exists university_id uuid references universities(id) on delete set null;

create index if not exists idx_applications_university on applications (university_id);

notify pgrst, 'reload schema';
