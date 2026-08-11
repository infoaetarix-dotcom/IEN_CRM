-- ============================================================
-- 0022_applications.sql — Applications (one lead → many applications)
-- ------------------------------------------------------------
-- A visa/study application belonging to exactly one lead. The form mirrors
-- the lead form almost field-for-field (same categorical CHECK constraints
-- as leads, see 0002_extended_lead_fields.sql) plus two application-only
-- additions: passport_number and a document library. Unlike Finance and
-- Activity Tracker, this is a CORE feature — no Super Admin module toggle,
-- open to both admin and agent, same shared-visibility model as `leads`
-- itself (org-wide, no per-user restriction — see 0008_shared_lead_visibility.sql).
--
-- Cascades on the lead: deleting a lead deletes all its applications
-- (`lead_id ... on delete cascade`), since an application only exists in
-- relation to its lead.
--
-- SAFE ON A LIVE TABLE: purely additive, new tables only.
-- ============================================================

create table if not exists applications (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references organizations(id) on delete cascade,
  lead_id                uuid not null references leads(id) on delete cascade,
  application_number     bigint unique,
  status                 lead_status not null default 'new',

  -- Copied from the lead at creation time (a snapshot, not a live link —
  -- editing the application never touches the original lead or vice versa).
  full_name              text,
  email                  text,
  phone                  text,
  date_of_birth          date check (
                           date_of_birth is null or (
                             date_of_birth <= current_date
                             and date_of_birth >= current_date - interval '120 years'
                           )
                         ),
  city                   text,
  district               text,
  target_country         text,
  institution            text,
  program                text,
  intake_season          text,
  intake_year            smallint,
  highest_education      text,
  last_qualification     text,
  prior_institution      text,
  passing_year           smallint,
  grading_system         text,
  grade_value            numeric(6,2),
  work_experience_years  smallint,
  work_experience_detail text,
  english_test           text,
  english_score          numeric(4,1),
  funding_source         text,
  prior_rejection        boolean default false,
  prior_rejection_detail text,

  -- Application-only fields.
  passport_number        text,

  created_by             uuid references profiles(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- Same standardized-value constraints as leads (0002_extended_lead_fields.sql)
-- so analytics/labels stay consistent between the two tables.
alter table applications
  add constraint applications_passing_year_chk
    check (passing_year is null or passing_year between 1950 and (extract(year from now())::int + 1)),
  add constraint applications_grading_system_chk
    check (grading_system is null or grading_system in ('cgpa_4','cgpa_5','percentage','other')),
  add constraint applications_grade_value_chk
    check (
      grade_value is null or grading_system is null
      or (grading_system = 'cgpa_4'     and grade_value >= 0 and grade_value <= 4.0)
      or (grading_system = 'cgpa_5'     and grade_value >= 0 and grade_value <= 5.0)
      or (grading_system = 'percentage' and grade_value >= 0 and grade_value <= 100)
      or (grading_system = 'other'      and grade_value >= 0)
    ),
  add constraint applications_work_years_chk
    check (work_experience_years is null or work_experience_years between 0 and 60),
  add constraint applications_english_test_chk
    check (english_test is null or english_test in ('ielts','toefl','pte','duolingo','planned','none')),
  add constraint applications_english_score_chk
    check (english_score is null or (english_score >= 0 and english_score <= 120)),
  add constraint applications_intake_season_chk
    check (intake_season is null or intake_season in ('spring','summer','fall','winter')),
  add constraint applications_intake_year_chk
    check (intake_year is null or intake_year between 2024 and 2035),
  add constraint applications_funding_source_chk
    check (funding_source is null or funding_source in ('self','family','loan','scholarship','employer','other'));

create index if not exists idx_applications_org        on applications(organization_id);
create index if not exists idx_applications_lead        on applications(lead_id);
create index if not exists idx_applications_status      on applications(status);
create index if not exists idx_applications_created     on applications(created_at desc);

-- Gapless sequential "Application #", same mechanism as lead_number
-- (0010_lead_number_gapless.sql) — MAX+1 at insert time via trigger rather
-- than an identity/sequence, so numbers don't jump on a deleted/rolled-back
-- row. Global across the table (not per-org), matching how lead_number works.
create or replace function public.set_application_number() returns trigger
language plpgsql as $$
begin
  if new.application_number is null then
    new.application_number := coalesce((select max(application_number) from applications), 0) + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_application_number on applications;
create trigger trg_set_application_number
before insert on applications
for each row
execute function public.set_application_number();

drop trigger if exists trg_applications_touch on applications;
create trigger trg_applications_touch
before update on applications
for each row execute function public.touch_updated_at();

alter table applications enable row level security;

-- Same shared model as leads: any active member (admin or agent) of the
-- owning org can read/write any application in that org. No public writer
-- exists for this table (applications has no public form — internal only),
-- so unlike `leads`, authenticated inserts are allowed directly.
drop policy if exists applications_all on applications;
create policy applications_all on applications for all
  using (
    public.is_super_admin()
    or organization_id = public.current_org()
  )
  with check (
    public.is_super_admin()
    or organization_id = public.current_org()
  );

grant select, insert, update, delete on applications to authenticated;
grant all on applications to service_role;

-- ============================================================
-- APPLICATION DOCUMENTS
-- ------------------------------------------------------------
-- Row metadata is normal org-scoped RLS like every other tenant table (so
-- the document list can be queried directly with the session client). The
-- underlying file bytes are NOT: the Storage bucket below is private with
-- no object-level policies at all — upload/download/delete all go through
-- a guarded server action using the service role (see app/(admin)/
-- applications/actions.ts), the same pattern org-logos uses
-- (0007_org_branding.sql), except that bucket is public-read and this one
-- is fully private since applicant documents are sensitive.
-- ============================================================

create table if not exists application_documents (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  application_id  uuid not null references applications(id) on delete cascade,
  file_name       text not null,
  storage_path    text not null,
  file_size       bigint,
  uploaded_by     uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_application_documents_application
  on application_documents(application_id);

alter table application_documents enable row level security;

drop policy if exists application_documents_all on application_documents;
create policy application_documents_all on application_documents for all
  using (
    public.is_super_admin()
    or organization_id = public.current_org()
  )
  with check (
    public.is_super_admin()
    or organization_id = public.current_org()
  );

grant select, insert, update, delete on application_documents to authenticated;
grant all on application_documents to service_role;

insert into storage.buckets (id, name, public)
values ('application-documents', 'application-documents', false)
on conflict (id) do nothing;
-- Deliberately no storage.objects policies — private bucket, service-role-only
-- access, mirroring the reasoning in 0007_org_branding.sql for org-logos but
-- inverted (that bucket is public-read; this one has no direct client access
-- at all, not even read, since these are private applicant documents).

notify pgrst, 'reload schema';
