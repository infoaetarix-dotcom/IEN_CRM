-- ============================================================
-- 0052_attendance.sql — staff clock in / clock out
-- ------------------------------------------------------------
-- An opt-in module ('attendance'), switched on per org by a super admin in
-- /super/orgs/{id}. Agents clock in and out from the CRM's top bar; admins
-- see everyone's records on /attendance. Admins themselves don't clock in.
--
-- Office or remote is decided by the request's IP address against the
-- org's office networks, which ONLY a super admin sets (Super Admin →
-- Office network). The IP is only known to the server, so every write here
-- goes through the app's server code with the service role, after its own
-- guard — there is deliberately no insert/update/delete grant for
-- `authenticated`. Otherwise an agent could call the API directly and
-- record any place or time they like.
--
-- Auto clock-out: while clocked in, the CRM pings every 2 minutes, which
-- bumps last_seen_at. A session not seen for 5 minutes (CRM closed, laptop
-- asleep or shut down, internet gone) is closed AT last_seen_at — when the
-- agent actually left — by attendance_close_stale() below. A session also
-- never runs past local midnight of its day (day_ends_at): a new day always
-- starts from "Clock in".
-- ============================================================

insert into modules (key, name, description) values
  ('attendance', 'Attendance', 'Staff clock in / clock out from the top bar, office or remote by IP, with admin reports')
on conflict (key) do nothing;

-- ---------- office networks (super admin only) ----------

create table if not exists attendance_office_networks (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  -- An IPv4 address or range ("203.0.113.7", "203.0.113.0/24") or an IPv6
  -- network ("2400:adc1:1:2::/64"), normalised by the app before saving.
  network         text not null check (length(btrim(network)) between 3 and 64),
  created_at      timestamptz not null default now(),
  constraint attendance_office_networks_unique unique (organization_id, network)
);

-- ---------- sessions ----------

create table if not exists attendance_sessions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations(id) on delete cascade,
  profile_id       uuid not null references profiles(id) on delete cascade,
  -- The org-local calendar day this session belongs to (clock-in day), and
  -- the instant that day ends (next local midnight). Both are worked out in
  -- the org's time zone by the app at clock-in.
  work_date        date not null,
  day_ends_at      timestamptz not null,
  clock_in_at      timestamptz not null default now(),
  clock_in_ip      text,
  clock_in_place   text not null check (clock_in_place in ('office', 'remote')),
  -- Latest ping. An auto clock-out uses its time and place.
  last_seen_at     timestamptz not null default now(),
  last_seen_ip     text,
  last_seen_place  text not null check (last_seen_place in ('office', 'remote')),
  clock_out_at     timestamptz,
  clock_out_ip     text,
  clock_out_place  text check (clock_out_place in ('office', 'remote')),
  -- 'manual' = the agent clicked Clock out; 'auto' = closed by the system.
  clock_out_method text check (clock_out_method in ('manual', 'auto')),
  created_at       timestamptz not null default now(),
  constraint attendance_sessions_closed_shape check (
    (clock_out_at is null and clock_out_place is null and clock_out_method is null)
    or (clock_out_at is not null and clock_out_place is not null and clock_out_method is not null
        and clock_out_at >= clock_in_at)
  )
);

-- At most one open session per person — a double click can't start two.
create unique index if not exists attendance_sessions_one_open
  on attendance_sessions (profile_id) where clock_out_at is null;
create index if not exists idx_attendance_sessions_org_date
  on attendance_sessions (organization_id, work_date desc);
create index if not exists idx_attendance_sessions_profile_date
  on attendance_sessions (profile_id, work_date desc);

-- ---------- RLS: read-only for staff; writes via the server only ----------

create or replace function public.attendance_enabled(org uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_modules
    where organization_id = org and module_key = 'attendance' and enabled
  );
$$;

alter table attendance_office_networks enable row level security;
alter table attendance_sessions        enable row level security;

-- Office networks: no policy for `authenticated` at all — read and written
-- only by server code (service role) on behalf of a super admin, or to
-- decide office/remote at clock-in.

-- Sessions: an agent reads their own; an org admin reads their org's.
-- Only while the module is on.
drop policy if exists attendance_sessions_read on attendance_sessions;
create policy attendance_sessions_read on attendance_sessions for select
  using (
    organization_id = public.current_org()
    and public.attendance_enabled(organization_id)
    and (profile_id = auth.uid() or public.is_admin())
  );

grant select on attendance_sessions to authenticated;
grant all on attendance_sessions, attendance_office_networks to service_role;

-- ---------- auto clock-out ----------

-- Close every open session that has gone quiet (no ping for stale_seconds)
-- or whose day has ended. It closes at the last ping (capped at the end of
-- its day), in the place seen at that ping. Pass only_profile to sweep just
-- one person. Returns what it closed. Server-only (service role).
create or replace function public.attendance_close_stale(stale_seconds integer default 300, only_profile uuid default null)
returns table (session_id uuid, profile_id uuid, clock_out_at timestamptz)
language sql volatile security definer set search_path = public as $$
  update attendance_sessions s
     set clock_out_at     = least(s.last_seen_at, s.day_ends_at),
         clock_out_ip     = s.last_seen_ip,
         clock_out_place  = s.last_seen_place,
         clock_out_method = 'auto'
   where s.clock_out_at is null
     and (only_profile is null or s.profile_id = only_profile)
     and (s.last_seen_at < now() - make_interval(secs => stale_seconds) or now() >= s.day_ends_at)
  returning s.id, s.profile_id, s.clock_out_at;
$$;

revoke execute on function public.attendance_close_stale(integer, uuid) from public, anon, authenticated;
grant execute on function public.attendance_close_stale(integer, uuid) to service_role;

notify pgrst, 'reload schema';
