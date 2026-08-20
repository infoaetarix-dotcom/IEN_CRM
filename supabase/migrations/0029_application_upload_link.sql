-- ============================================================
-- 0029_application_upload_link.sql — Student document upload link
-- ------------------------------------------------------------
-- Lets staff copy a link that opens a public, unauthenticated page where a
-- student can upload documents for exactly one application — no login, no
-- other application data exposed. Same "unguessable token instead of a
-- session" idea as leads.submission_token (0003_progressive_capture.sql),
-- except the token alone (no application id) is what the public page looks
-- up, so — unlike submission_token — it needs to be unique on its own.
--
-- Expiry protects against an old, forgotten link being used to plant
-- fraudulent documents into an application long after the student actually
-- needed it. "Regenerate link" (an admin/agent action) rotates the token and
-- resets the expiry together, immediately invalidating the old link.
--
-- SAFE ON A LIVE TABLE: purely additive columns with defaults.
-- ============================================================

alter table applications
  add column if not exists document_upload_token uuid not null default gen_random_uuid() unique,
  add column if not exists document_upload_expires_at timestamptz not null default (now() + interval '30 days');

-- Distinguishes a document the student submitted through the public link
-- from one staff uploaded directly, so the Documents panel can label it.
alter table application_documents
  add column if not exists uploaded_by_student boolean not null default false;

notify pgrst, 'reload schema';
