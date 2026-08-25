-- ============================================================
-- 0032_lead_reference_and_passport.sql — reference name/note + passport
-- ------------------------------------------------------------
-- reference_name / reference_note: who referred a lead (shown only when
-- utm_source is personal_reference/old_student_reference — see
-- 0031_reference_lead_sources.sql). Persistent fields, not a note log entry
-- — reopening edit mode must show the current value, not a blank box.
--
-- passport_number: same field applications already have, now also
-- captured at the lead stage (Create query form + lead editor).
--
-- SAFE ON A LIVE TABLE: additive, nullable columns only.
-- ============================================================

alter table leads
  add column if not exists reference_name text,
  add column if not exists reference_note text,
  add column if not exists passport_number text;
