-- ============================================================
-- 0033_lead_documents.sql — Student document upload link, for leads
-- ------------------------------------------------------------
-- A parallel system to applications' document-upload link
-- (0029_application_upload_link.sql), deliberately not shared with it — a
-- lead might never become an application, or might become several, so its
-- documents shouldn't be tied to one specific application. Same mechanism
-- throughout: unguessable token instead of a session, 30-day expiry,
-- regenerate rotates both together, RLS mirrors every other shared-data
-- tenant table.
--
-- SAFE ON A LIVE TABLE: new columns + a new table only.
-- ============================================================

alter table leads
  add column if not exists document_upload_token uuid not null default gen_random_uuid() unique,
  add column if not exists document_upload_expires_at timestamptz not null default (now() + interval '30 days');

create table if not exists lead_documents (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references organizations(id) on delete cascade,
  lead_id            uuid not null references leads(id) on delete cascade,
  file_name          text not null,
  storage_path       text not null,
  file_size          bigint,
  uploaded_by        uuid references profiles(id) on delete set null,
  uploaded_by_lead   boolean not null default false,
  created_at         timestamptz not null default now()
);

create index if not exists idx_lead_documents_lead on lead_documents(lead_id);

alter table lead_documents enable row level security;

drop policy if exists lead_documents_all on lead_documents;
create policy lead_documents_all on lead_documents for all
  using (
    public.is_super_admin()
    or organization_id = public.current_org()
  )
  with check (
    public.is_super_admin()
    or organization_id = public.current_org()
  );

grant select, insert, update, delete on lead_documents to authenticated;
grant all on lead_documents to service_role;

insert into storage.buckets (id, name, public)
values ('lead-documents', 'lead-documents', false)
on conflict (id) do nothing;
-- Deliberately no storage.objects policies — private bucket, service-role-only
-- access, same reasoning as application-documents (0022_applications.sql).

notify pgrst, 'reload schema';
