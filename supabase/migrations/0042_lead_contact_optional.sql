-- ============================================================
-- 0042_lead_contact_optional.sql — full name/email/phone clearable
-- ------------------------------------------------------------
-- The lead editor (Edit Lead) now allows staff to clear full_name, email,
-- and phone the same as every other field. These were NOT NULL from
-- 0001_init.sql (the public form always required them) — relaxed here so a
-- staff correction that blanks one doesn't hit a database error. Note: a
-- lead saved with none of them can't be emailed, WhatsApp'd, or shown
-- meaningfully in the leads list until filled back in — an accepted
-- product tradeoff, not an oversight.
-- ============================================================

alter table leads
  alter column full_name drop not null,
  alter column email drop not null,
  alter column phone drop not null;

notify pgrst, 'reload schema';
