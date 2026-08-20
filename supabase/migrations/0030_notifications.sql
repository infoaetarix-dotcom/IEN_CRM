-- ============================================================
-- 0030_notifications.sql — In-app + email alert when a new lead lands
-- ------------------------------------------------------------
-- One row per (event, recipient) — not one shared row per event — so each
-- admin/agent has their own independent read/unread state, the same way
-- Slack/GitHub notifications work. Recipients are every active staff member
-- in the org (shared-visibility model, same reasoning as leads/applications/
-- universities elsewhere in this schema): whoever's free grabs the new lead
-- fastest, rather than routing to one fixed inbox.
--
-- Written only by the service role (the public apply form has no session),
-- read/updated by the owning profile only.
--
-- Realtime: added to the supabase_realtime publication so the bell in the
-- admin header updates live via postgres_changes, no polling/refresh.
--
-- SAFE ON A LIVE TABLE: new table only.
-- ============================================================

create table if not exists notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  profile_id      uuid not null references profiles(id) on delete cascade,
  type            text not null,
  title           text not null,
  body            text,
  link            text,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists idx_notifications_profile
  on notifications (profile_id, created_at desc);
create index if not exists idx_notifications_profile_unread
  on notifications (profile_id) where read_at is null;

alter table notifications enable row level security;

drop policy if exists notifications_select on notifications;
create policy notifications_select on notifications for select
  using (profile_id = auth.uid());

drop policy if exists notifications_update on notifications;
create policy notifications_update on notifications for update
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

grant select, update on notifications to authenticated;
grant all on notifications to service_role;

-- Idempotent: a bare `alter publication ... add table` errors on a second
-- run if the table is already a member.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;

notify pgrst, 'reload schema';
