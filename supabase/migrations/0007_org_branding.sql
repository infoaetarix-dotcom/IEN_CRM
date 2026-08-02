-- ============================================================
-- 0007_org_branding.sql — per-tenant branding (white-label)
-- ------------------------------------------------------------
-- The app currently hardcodes "IEN" in ~17 places, so a second consultancy
-- would see IEN's name throughout their own CRM (and their applicants would
-- consent to IEN). This adds the data every tenant-facing surface reads from:
--
--   logo_url    — the consultancy's logo, uploaded via /super into Storage
--   legal_name  — full public-facing name for consent text and emails
--                 (organizations.name stays the short label used in the UI)
--
-- Also creates the public `org-logos` storage bucket. Logos are non-sensitive
-- brand assets displayed on the public application form, so public READ is
-- correct; writes are service-role only (the /super upload action), so a
-- tenant can never overwrite another tenant's logo.
--
-- SAFE ON A LIVE TABLE: additive and nullable. Existing orgs keep working and
-- fall back to an initials monogram until a logo is uploaded.
-- ============================================================

alter table organizations
  add column if not exists logo_url   text,
  add column if not exists legal_name text;

-- Storage bucket for tenant logos (public read).
insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do nothing;

-- Anyone may read a logo (they appear on the public application form).
drop policy if exists "org logos are publicly readable" on storage.objects;
create policy "org logos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'org-logos');

-- No insert/update/delete policies: uploads go through the service role in the
-- /super console only, so tenants cannot write to this bucket at all.
