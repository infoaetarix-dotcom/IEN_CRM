-- ============================================================
-- 0006_must_change_password.sql — force new staff to set their own password
-- ------------------------------------------------------------
-- Adds a per-user flag that forces a password change on next login. When an
-- admin creates a staff member with a temporary password, the flag is set true;
-- the CRM redirects that user to /change-password until they pick their own,
-- then it clears. Existing users are unaffected (default false).
--
-- SAFE ON A LIVE TABLE: additive, NOT NULL with a default, so existing rows get
-- `false` automatically. Run before deploying the code that reads it.
-- ============================================================

alter table profiles
  add column if not exists must_change_password boolean not null default false;
