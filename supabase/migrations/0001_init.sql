-- =========================================================
-- IEN Visa Consultancy CRM — initial schema, RLS, grants
-- README §7. Run in the Supabase SQL editor (or via CLI).
-- NOTE: `age` is replaced by `date_of_birth` (DOB) per build decision.
-- =========================================================

-- =========================================================
-- ENUMS
-- =========================================================
create type user_role      as enum ('admin', 'agent');
create type lead_status     as enum ('new','contacted','in_progress','accepted','rejected','follow_up');
create type lead_source     as enum ('instagram','facebook','linkedin','youtube','whatsapp','direct','other');
create type message_channel as enum ('email');           -- 'whatsapp' added in full CRM
create type message_status  as enum ('queued','sent','failed');

-- =========================================================
-- PROFILES  (extends Supabase auth.users)
-- =========================================================
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  role        user_role not null default 'agent',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Auto-create a profile when a new auth user is created.
-- Role defaults to 'agent'; promote the first user to 'admin' in seed.sql.
create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'agent');
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- LEADS
-- =========================================================
create table leads (
  id                     uuid primary key default gen_random_uuid(),
  full_name              text not null,
  email                  text not null,
  phone                  text not null,
  date_of_birth          date check (
                           date_of_birth <= current_date
                           and date_of_birth >= current_date - interval '120 years'
                         ),
  target_country         text,
  institution            text,
  program                text,
  highest_education      text,
  prior_rejection        boolean default false,
  prior_rejection_detail text,
  utm_source             lead_source not null default 'direct',
  utm_medium             text not null default 'direct',
  utm_campaign           text,
  status                 lead_status not null default 'new',
  assigned_to            uuid references profiles(id) on delete set null,
  consent_given          boolean not null default false,
  consent_at             timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index idx_leads_status   on leads(status);
create index idx_leads_source   on leads(utm_source);
create index idx_leads_assigned on leads(assigned_to);
create index idx_leads_created  on leads(created_at desc);
create index idx_leads_email    on leads(lower(email));

-- =========================================================
-- LEAD NOTES  (append-only)
-- =========================================================
create table lead_notes (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references leads(id) on delete cascade,
  author_id  uuid not null references profiles(id),
  body       text not null,
  created_at timestamptz not null default now()
);
create index idx_notes_lead on lead_notes(lead_id, created_at desc);

-- =========================================================
-- STATUS HISTORY  (pipeline audit)
-- =========================================================
create table lead_status_history (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  from_status lead_status,
  to_status   lead_status not null,
  changed_by  uuid references profiles(id),
  changed_at  timestamptz not null default now()
);
create index idx_history_lead on lead_status_history(lead_id, changed_at desc);

-- =========================================================
-- MESSAGES  (every outbound send is logged)
-- =========================================================
create table messages (
  id                  uuid primary key default gen_random_uuid(),
  lead_id             uuid not null references leads(id) on delete cascade,
  channel             message_channel not null default 'email',
  template_key        text,
  subject             text,
  body                text,
  status              message_status not null default 'queued',
  provider_message_id text,
  error_detail        text,
  sent_by             uuid references profiles(id),   -- null = system (auto confirmation)
  created_at          timestamptz not null default now()
);
create index idx_messages_lead on messages(lead_id, created_at desc);

-- =========================================================
-- EMAIL TEMPLATES  (editable by admin)
-- =========================================================
create table email_templates (
  key        text primary key,
  name       text not null,
  subject    text not null,
  body       text not null,           -- supports {{full_name}}, {{program}} etc.
  is_auto    boolean not null default false,
  updated_at timestamptz not null default now()
);

-- =========================================================
-- AUDIT LOG
-- =========================================================
create table audit_log (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references profiles(id),
  action     text not null,
  entity     text not null,
  entity_id  uuid,
  metadata   jsonb,
  created_at timestamptz not null default now()
);
create index idx_audit_created on audit_log(created_at desc);

-- =========================================================
-- updated_at trigger
-- =========================================================
create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_leads_touch before update on leads
  for each row execute function public.touch_updated_at();

-- =========================================================
-- ROW-LEVEL SECURITY
-- =========================================================
alter table profiles            enable row level security;
alter table leads               enable row level security;
alter table lead_notes          enable row level security;
alter table lead_status_history enable row level security;
alter table messages            enable row level security;
alter table email_templates     enable row level security;
alter table audit_log           enable row level security;

-- Helper: is the current user an admin?
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin' and is_active);
$$;

-- ---------- PROFILES ----------
create policy profiles_self_read   on profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_admin_write on profiles for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- LEADS ----------
-- Admin: full access. Agent: only leads assigned to them (assigned-only model).
-- NOTE: there is intentionally NO insert policy for authenticated users.
--       Public form inserts run server-side with the service role.
create policy leads_read on leads for select
  using (public.is_admin() or assigned_to = auth.uid());
create policy leads_update on leads for update
  using (public.is_admin() or assigned_to = auth.uid())
  with check (public.is_admin() or assigned_to = auth.uid());
create policy leads_admin_delete on leads for delete using (public.is_admin());

-- ---------- LEAD NOTES ----------
create policy notes_read on lead_notes for select using (
  public.is_admin() or exists(
    select 1 from leads l where l.id = lead_id and l.assigned_to = auth.uid()
  )
);
create policy notes_insert on lead_notes for insert with check (
  author_id = auth.uid() and (
    public.is_admin() or exists(
      select 1 from leads l where l.id = lead_id and l.assigned_to = auth.uid()
    )
  )
);

-- ---------- STATUS HISTORY ----------
create policy history_read on lead_status_history for select using (
  public.is_admin() or exists(
    select 1 from leads l where l.id = lead_id and l.assigned_to = auth.uid()
  )
);

-- ---------- MESSAGES ----------
create policy messages_read on messages for select using (
  public.is_admin() or exists(
    select 1 from leads l where l.id = lead_id and l.assigned_to = auth.uid()
  )
);

-- ---------- EMAIL TEMPLATES ----------
create policy templates_read  on email_templates for select using (auth.uid() is not null);
create policy templates_write on email_templates for all
  using (public.is_admin()) with check (public.is_admin());

-- ---------- AUDIT LOG ----------
create policy audit_admin_read on audit_log for select using (public.is_admin());

-- =========================================================
-- DATA API PRIVILEGES  (least privilege)
-- anon gets NOTHING on these tables: the public form writes via the service
-- role, server-side only. RLS further gates rows.
-- =========================================================
grant usage on schema public to authenticated, service_role;

grant all on all tables in schema public to service_role;

grant select on
  leads, profiles, lead_notes, lead_status_history,
  messages, email_templates, audit_log
  to authenticated;
grant insert on lead_notes to authenticated;
grant update on leads to authenticated;
grant insert, update, delete on email_templates to authenticated;

-- Reload PostgREST schema cache (harmless if it auto-reloads).
notify pgrst, 'reload schema';
