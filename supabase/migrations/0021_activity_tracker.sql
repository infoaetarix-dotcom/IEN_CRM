-- ============================================================
-- 0021_activity_tracker.sql — Activity Tracker module
-- ------------------------------------------------------------
-- Adds "Activity Tracker" to the module catalog (opt-in, off by default —
-- not in DEFAULT_MODULES, so it only appears once a Super Admin checks it
-- in Package — modules) and the activity_entries table: a log of work
-- Aetarix does *for* a consultancy (an Instagram reel posted, an ad
-- campaign run, etc.), so that consultancy's own admin can see a running
-- report of it inside their CRM.
--
-- Asymmetric on purpose, unlike every other tenant table:
--   - WRITE (insert/update/delete): Aetarix (Super Admin) only, via the
--     service-role client from /super — never the tenant.
--   - READ: the owning org's admin only (agents get nothing, same as
--     Finance). No self-service create/edit/delete for the tenant at all.
-- RLS below grants ONLY select to authenticated; there is no
-- insert/update/delete policy for that role at all, so a tenant write
-- attempt is rejected even before role-based app guards would catch it.
--
-- SAFE ON A LIVE TABLE: purely additive. No existing org has this module
-- enabled, so nothing changes until a Super Admin opts an org in.
-- ============================================================

insert into modules (key, name, description) values
  ('activity_tracker', 'Activity Tracker', 'Aetarix-reported activity log — admin-only, read-only for the consultancy')
on conflict (key) do nothing;

create table if not exists activity_entries (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  created_by      uuid not null references profiles(id) on delete cascade,
  category        text not null,
  title           text not null,
  description     text,
  activity_date   date not null default current_date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_activity_entries_org_date
  on activity_entries (organization_id, activity_date desc);

create trigger trg_activity_entries_touch
  before update on activity_entries
  for each row execute function public.touch_updated_at();

alter table activity_entries enable row level security;

-- Read-only for the owning org's admins. No write policy for `authenticated`
-- at all — every insert/update/delete goes through requireSuperAdmin() +
-- the service-role client in app/super/actions.ts, which bypasses RLS.
drop policy if exists activity_entries_read on activity_entries;
create policy activity_entries_read on activity_entries for select
  using (
    organization_id = public.current_org()
    and public.is_admin()
  );

grant select on activity_entries to authenticated;
grant all on activity_entries to service_role;

notify pgrst, 'reload schema';
