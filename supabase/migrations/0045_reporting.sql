-- ============================================================
-- 0045_reporting.sql — per-consultancy reporting setup
-- ------------------------------------------------------------
-- Backs Settings → Reporting and the reports under Settings.
--
-- reporting_periods: each consultancy's own lead reporting periods — a
-- named run of months whose leads are reported in a later month, e.g.
-- "Jan–Feb intake": January–February, reported in March. Months are 1–12;
-- a period may wrap the year (start_month > end_month, e.g. Nov–Jan).
-- Overlap between periods is prevented in the app (Settings action), not
-- here — it's a cross-row rule and periods are few and admin-edited.
--
-- reporting_settings: one row per org, currently just the time zone that
-- "today" / "this month" and report boundaries are computed in. Lives here
-- rather than on organizations because tenant admins can't write that
-- table (only super admins can, 0004) and this is tenant self-service.
-- No row = the app's default zone (Asia/Karachi, the platform's home
-- market), so nothing changes until an admin picks another.
--
-- Both: readable by everyone in the org (reports are visible to all
-- staff), writable by the org's admins only. Purely additive — no existing
-- table or row is touched.
-- ============================================================

create table if not exists reporting_periods (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name            text not null check (length(btrim(name)) between 1 and 60),
  start_month     smallint not null check (start_month between 1 and 12),
  end_month       smallint not null check (end_month between 1 and 12),
  report_month    smallint not null check (report_month between 1 and 12),
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_reporting_periods_org on reporting_periods (organization_id, start_month);

create trigger trg_reporting_periods_touch
  before update on reporting_periods
  for each row execute function public.touch_updated_at();

create table if not exists reporting_settings (
  organization_id uuid primary key references organizations(id) on delete cascade,
  timezone        text not null default 'Asia/Karachi' check (length(btrim(timezone)) between 1 and 64),
  updated_at      timestamptz not null default now()
);

create trigger trg_reporting_settings_touch
  before update on reporting_settings
  for each row execute function public.touch_updated_at();

alter table reporting_periods  enable row level security;
alter table reporting_settings enable row level security;

drop policy if exists reporting_periods_read on reporting_periods;
create policy reporting_periods_read on reporting_periods for select
  using (public.is_super_admin() or organization_id = public.current_org());

drop policy if exists reporting_periods_admin_write on reporting_periods;
create policy reporting_periods_admin_write on reporting_periods for all
  using (public.is_super_admin() or (organization_id = public.current_org() and public.is_admin()))
  with check (public.is_super_admin() or (organization_id = public.current_org() and public.is_admin()));

drop policy if exists reporting_settings_read on reporting_settings;
create policy reporting_settings_read on reporting_settings for select
  using (public.is_super_admin() or organization_id = public.current_org());

drop policy if exists reporting_settings_admin_write on reporting_settings;
create policy reporting_settings_admin_write on reporting_settings for all
  using (public.is_super_admin() or (organization_id = public.current_org() and public.is_admin()))
  with check (public.is_super_admin() or (organization_id = public.current_org() and public.is_admin()));

grant select, insert, update, delete on reporting_periods, reporting_settings to authenticated;
grant all on reporting_periods, reporting_settings to service_role;

notify pgrst, 'reload schema';
