-- ============================================================
-- 0023_application_notes.sql — Notes on applications
-- ------------------------------------------------------------
-- Same append-only note pattern as lead_notes, applied to applications.
-- RLS mirrors the CURRENT lead_notes policy (0012_shared_notes_author_email.sql
-- — org-wide read, author-attributed insert), not the older assigned-agent
-- version from 0004 that no longer applies now that lead assignment is gone.
-- ============================================================

create table if not exists application_notes (
  id              uuid primary key default gen_random_uuid(),
  application_id  uuid not null references applications(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  author_id       uuid not null references profiles(id),
  body            text not null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_application_notes_application
  on application_notes(application_id, created_at desc);

alter table application_notes enable row level security;

drop policy if exists application_notes_read on application_notes;
create policy application_notes_read on application_notes for select using (
  public.is_super_admin() or organization_id = public.current_org()
);

drop policy if exists application_notes_insert on application_notes;
create policy application_notes_insert on application_notes for insert with check (
  author_id = auth.uid() and organization_id = public.current_org()
);

grant select, insert on application_notes to authenticated;
grant all on application_notes to service_role;

notify pgrst, 'reload schema';
