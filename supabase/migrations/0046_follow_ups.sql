-- ============================================================
-- 0046_follow_ups.sql — follow-up dates on leads and applications
-- ------------------------------------------------------------
-- Staff set a follow-up date on a lead or an application from the
-- calendar button in its table row (or its detail page). On the day, and
-- every day after until someone marks it done, all staff get a summary
-- email + bell notification (morning and afternoon, Pakistan time — see
-- /api/cron/follow-up-reminders and vercel.json).
--
-- follow_ups: one row per follow-up. Belongs to exactly one lead OR one
-- application. Date only — no time of day. A follow-up is closed only by
-- someone clicking "Mark done" (completed_at / completed_by); nothing
-- closes it automatically. Done rows are kept as history. At most one
-- open follow-up per lead / application (partial unique indexes).
--
-- follow_up_reminder_runs: one row per (org, day, slot) once that
-- reminder has gone out, so a cron retry or a manual re-run never emails
-- the team twice. Written only by the cron (service role).
--
-- Access: org-shared like leads and applications — everyone in the org
-- can see and manage its follow-ups; writes must target a lead /
-- application in the caller's own org. Purely additive.
-- ============================================================

create table if not exists follow_ups (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  lead_id         uuid references leads(id) on delete cascade,
  application_id  uuid references applications(id) on delete cascade,
  due_date        date not null,
  note            text check (note is null or length(note) <= 500),
  created_by      uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  completed_at    timestamptz,
  completed_by    uuid references profiles(id) on delete set null,
  constraint follow_ups_one_target check ((lead_id is null) <> (application_id is null))
);

create unique index if not exists uq_follow_ups_open_lead
  on follow_ups (lead_id) where completed_at is null and lead_id is not null;
create unique index if not exists uq_follow_ups_open_application
  on follow_ups (application_id) where completed_at is null and application_id is not null;
create index if not exists idx_follow_ups_open_due
  on follow_ups (organization_id, due_date) where completed_at is null;
create index if not exists idx_follow_ups_lead on follow_ups (lead_id);
create index if not exists idx_follow_ups_application on follow_ups (application_id);

create trigger trg_follow_ups_touch
  before update on follow_ups
  for each row execute function public.touch_updated_at();

create table if not exists follow_up_reminder_runs (
  organization_id uuid not null references organizations(id) on delete cascade,
  run_date        date not null,
  slot            text not null check (slot in ('morning', 'afternoon')),
  follow_up_count integer not null default 0,
  created_at      timestamptz not null default now(),
  primary key (organization_id, run_date, slot)
);

alter table follow_ups              enable row level security;
alter table follow_up_reminder_runs enable row level security;

drop policy if exists follow_ups_all on follow_ups;
create policy follow_ups_all on follow_ups for all
  using (public.is_super_admin() or organization_id = public.current_org())
  with check (
    public.is_super_admin()
    or (
      organization_id = public.current_org()
      and (
        (lead_id is not null and exists (
          select 1 from leads l where l.id = lead_id and l.organization_id = public.current_org()))
        or (application_id is not null and exists (
          select 1 from applications a where a.id = application_id and a.organization_id = public.current_org()))
      )
    )
  );

-- Reminder runs: no tenant access at all; only the cron (service role) uses it.
grant select, insert, update, delete on follow_ups to authenticated;
grant all on follow_ups, follow_up_reminder_runs to service_role;

notify pgrst, 'reload schema';
