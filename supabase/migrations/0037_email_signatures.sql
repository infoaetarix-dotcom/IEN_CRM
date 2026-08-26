-- ============================================================
-- 0037_email_signatures.sql — Personal + shared email signatures
-- ------------------------------------------------------------
-- A signature isn't tied 1-to-1 to a person: a row is either personal
-- (profile_id set — belongs to one admin or agent) or shared/"Common"
-- (profile_id null — org-wide, usable by anyone and used as the fallback
-- for automated emails like the welcome auto-confirmation, which isn't
-- sent by any specific staff member). Any active admin or agent may
-- create/edit/delete EITHER kind — same shared-data model as universities
-- (0027) / student_finance_entries (0025) — profile_id is a data
-- attribute (whose signature this is), never an access boundary.
--
-- "At most one default" is enforced with two separate partial unique
-- indexes rather than app logic alone: one default per person (profile_id
-- alone is enough — a profile never moves between orgs in this app), and
-- one default among the shared rows per org (must include organization_id,
-- or "one shared default" would be enforced platform-wide instead of
-- per-org).
--
-- profile_id is ON DELETE CASCADE, not SET NULL like created_by — here
-- null is a meaningful state ("this is the shared signature"), not "no
-- owner," so a hard-deleted profile's personal signature must never
-- silently mutate into an org-wide shared one. Moot today (profiles are
-- never hard-deleted, only is_active is toggled) but it's the correct
-- semantics regardless.
--
-- SAFE ON A LIVE TABLE: purely additive. No org has any signatures yet.
-- ============================================================

create table if not exists email_signatures (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  profile_id      uuid references profiles(id) on delete cascade,
  title           text not null,
  body_html       text not null,
  is_default      boolean not null default false,
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_email_signatures_org on email_signatures (organization_id);
create index if not exists idx_email_signatures_profile on email_signatures (profile_id);

create unique index if not exists email_signatures_one_personal_default
  on email_signatures (profile_id) where is_default and profile_id is not null;
create unique index if not exists email_signatures_one_shared_default
  on email_signatures (organization_id) where is_default and profile_id is null;

create trigger trg_email_signatures_touch
  before update on email_signatures
  for each row execute function public.touch_updated_at();

alter table email_signatures enable row level security;

drop policy if exists email_signatures_all on email_signatures;
create policy email_signatures_all on email_signatures for all
  using (
    public.is_super_admin()
    or organization_id = public.current_org()
  )
  with check (
    public.is_super_admin()
    or organization_id = public.current_org()
  );

grant select, insert, update, delete on email_signatures to authenticated;
grant all on email_signatures to service_role;

-- Which signature (if any) rode along with a sent email — same role
-- messages.template_key already plays for templates.
alter table messages
  add column if not exists signature_id uuid references email_signatures(id) on delete set null;

notify pgrst, 'reload schema';
