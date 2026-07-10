-- =========================================================
-- 0004 — Multi-tenant foundation
-- Adds organizations (tenants), modules (packages), org scoping
-- on every table, a super-admin flag, and a full RLS rewrite that
-- isolates each consultancy's data. Existing data is migrated into a
-- default "IEN" organization so nothing breaks.
-- Run in the Supabase SQL editor AFTER 0003 (progressive_capture).
-- =========================================================

-- ---------------------------------------------------------
-- 1. New tables
-- ---------------------------------------------------------
create table if not exists organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,           -- powers /{slug}/apply
  status     text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now()
);

create table if not exists modules (
  key         text primary key,              -- 'leads','analytics','email',...
  name        text not null,
  description text
);

create table if not exists organization_modules (
  organization_id uuid not null references organizations(id) on delete cascade,
  module_key      text not null references modules(key) on delete cascade,
  enabled         boolean not null default true,
  primary key (organization_id, module_key)
);

-- Module catalog (packages are built from these).
insert into modules (key, name, description) values
  ('leads',          'Leads',           'Lead capture form + leads table & detail'),
  ('analytics',      'Analytics',       'Dashboard metrics and charts'),
  ('email',          'Email outreach',  'Templated email send + logging'),
  ('templates',      'Email templates', 'Editable email templates'),
  ('agents',         'Team management', 'Manage staff / agents'),
  ('whatsapp',       'WhatsApp',        'WhatsApp messaging (future)'),
  ('chatbot',        'Social chatbot',  'IG/FB chatbot ingestion (future)'),
  ('bulk_messaging', 'Bulk messaging',  'Batch outreach (future)')
on conflict (key) do nothing;

-- ---------------------------------------------------------
-- 2. Super-admin flag + org scoping on profiles
-- ---------------------------------------------------------
alter table profiles
  add column if not exists is_super_admin  boolean not null default false,
  add column if not exists organization_id uuid references organizations(id) on delete cascade;

-- ---------------------------------------------------------
-- 3. org_id on every tenant-owned table
-- ---------------------------------------------------------
alter table leads               add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table lead_notes          add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table lead_status_history add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table messages            add column if not exists organization_id uuid references organizations(id) on delete cascade;
alter table audit_log           add column if not exists organization_id uuid references organizations(id) on delete set null;

-- email_templates becomes per-org: key is no longer globally unique.
alter table email_templates add column if not exists organization_id uuid references organizations(id) on delete cascade;

-- ---------------------------------------------------------
-- 4. Backfill: default organization + move existing data in
-- ---------------------------------------------------------
do $$
declare def_org uuid;
begin
  insert into organizations (name, slug)
  values ('IEN Visa Consultancy', 'ien')
  on conflict (slug) do nothing;

  select id into def_org from organizations where slug = 'ien';

  update profiles            set organization_id = def_org where organization_id is null and is_super_admin = false;
  update leads               set organization_id = def_org where organization_id is null;
  update lead_notes          set organization_id = def_org where organization_id is null;
  update lead_status_history set organization_id = def_org where organization_id is null;
  update messages            set organization_id = def_org where organization_id is null;
  update audit_log           set organization_id = def_org where organization_id is null;
  update email_templates     set organization_id = def_org where organization_id is null;

  -- Enable every module for the default org.
  insert into organization_modules (organization_id, module_key)
    select def_org, key from modules
  on conflict do nothing;
end $$;

-- ---------------------------------------------------------
-- 5. email_templates: switch PK to (organization_id, key)
-- ---------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'email_templates_pkey') then
    alter table email_templates drop constraint email_templates_pkey;
  end if;
  alter table email_templates alter column organization_id set not null;
  if not exists (select 1 from pg_constraint where conname = 'email_templates_pkey') then
    alter table email_templates add constraint email_templates_pkey primary key (organization_id, key);
  end if;
end $$;

-- ---------------------------------------------------------
-- 6. Enforce NOT NULL on tenant tables (after backfill)
-- ---------------------------------------------------------
alter table leads               alter column organization_id set not null;
alter table lead_notes          alter column organization_id set not null;
alter table lead_status_history alter column organization_id set not null;
alter table messages            alter column organization_id set not null;

create index if not exists idx_leads_org      on leads(organization_id);
create index if not exists idx_notes_org       on lead_notes(organization_id);
create index if not exists idx_messages_org    on messages(organization_id);
create index if not exists idx_profiles_org    on profiles(organization_id);
create index if not exists idx_history_org     on lead_status_history(organization_id);

-- ---------------------------------------------------------
-- 7. Helper functions
-- ---------------------------------------------------------
create or replace function public.current_org() returns uuid
language sql stable security definer set search_path = public as $$
  select organization_id from profiles where id = auth.uid();
$$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and is_super_admin and is_active);
$$;

-- is_admin() stays: "current user is an active org admin".
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from profiles where id = auth.uid() and role = 'admin' and is_active);
$$;

-- ---------------------------------------------------------
-- 8. RLS rewrite — drop old policies, create org-scoped ones
-- ---------------------------------------------------------
alter table organizations        enable row level security;
alter table modules              enable row level security;
alter table organization_modules enable row level security;

-- PROFILES
drop policy if exists profiles_self_read   on profiles;
drop policy if exists profiles_admin_write on profiles;
create policy profiles_read on profiles for select using (
  id = auth.uid()
  or public.is_super_admin()
  or (public.is_admin() and organization_id = public.current_org())
);
create policy profiles_write on profiles for all using (
  public.is_super_admin()
  or (public.is_admin() and organization_id = public.current_org())
) with check (
  public.is_super_admin()
  or (public.is_admin() and organization_id = public.current_org())
);

-- LEADS
drop policy if exists leads_read         on leads;
drop policy if exists leads_update       on leads;
drop policy if exists leads_admin_delete on leads;
create policy leads_read on leads for select using (
  public.is_super_admin()
  or (organization_id = public.current_org() and (public.is_admin() or assigned_to = auth.uid()))
);
create policy leads_update on leads for update using (
  public.is_super_admin()
  or (organization_id = public.current_org() and (public.is_admin() or assigned_to = auth.uid()))
) with check (
  public.is_super_admin()
  or (organization_id = public.current_org() and (public.is_admin() or assigned_to = auth.uid()))
);
create policy leads_delete on leads for delete using (
  public.is_super_admin() or (public.is_admin() and organization_id = public.current_org())
);

-- LEAD NOTES
drop policy if exists notes_read   on lead_notes;
drop policy if exists notes_insert on lead_notes;
create policy notes_read on lead_notes for select using (
  public.is_super_admin() or (organization_id = public.current_org() and (
    public.is_admin() or exists(select 1 from leads l where l.id = lead_id and l.assigned_to = auth.uid())
  ))
);
create policy notes_insert on lead_notes for insert with check (
  author_id = auth.uid() and organization_id = public.current_org() and (
    public.is_admin() or exists(select 1 from leads l where l.id = lead_id and l.assigned_to = auth.uid())
  )
);

-- STATUS HISTORY
drop policy if exists history_read on lead_status_history;
create policy history_read on lead_status_history for select using (
  public.is_super_admin() or (organization_id = public.current_org() and (
    public.is_admin() or exists(select 1 from leads l where l.id = lead_id and l.assigned_to = auth.uid())
  ))
);

-- MESSAGES
drop policy if exists messages_read on messages;
create policy messages_read on messages for select using (
  public.is_super_admin() or (organization_id = public.current_org() and (
    public.is_admin() or exists(select 1 from leads l where l.id = lead_id and l.assigned_to = auth.uid())
  ))
);

-- EMAIL TEMPLATES
drop policy if exists templates_read  on email_templates;
drop policy if exists templates_write on email_templates;
create policy templates_read on email_templates for select using (
  public.is_super_admin() or organization_id = public.current_org()
);
create policy templates_write on email_templates for all using (
  public.is_super_admin() or (public.is_admin() and organization_id = public.current_org())
) with check (
  public.is_super_admin() or (public.is_admin() and organization_id = public.current_org())
);

-- AUDIT LOG
drop policy if exists audit_admin_read on audit_log;
create policy audit_read on audit_log for select using (
  public.is_super_admin() or (public.is_admin() and organization_id = public.current_org())
);

-- ORGANIZATIONS
create policy orgs_super on organizations for all
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy orgs_read_own on organizations for select
  using (id = public.current_org());

-- MODULES (catalog — readable by any signed-in user; only super admin writes)
create policy modules_read on modules for select using (auth.uid() is not null);
create policy modules_super on modules for all
  using (public.is_super_admin()) with check (public.is_super_admin());

-- ORGANIZATION_MODULES
create policy orgmods_super on organization_modules for all
  using (public.is_super_admin()) with check (public.is_super_admin());
create policy orgmods_read_own on organization_modules for select
  using (organization_id = public.current_org());

-- ---------------------------------------------------------
-- 9. Grants for the new tables (auto-expose is OFF)
-- ---------------------------------------------------------
grant all on organizations, modules, organization_modules to service_role;
grant select on organizations, modules, organization_modules to authenticated;

notify pgrst, 'reload schema';
