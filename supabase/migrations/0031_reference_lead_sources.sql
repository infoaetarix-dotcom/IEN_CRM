-- ============================================================
-- 0031_reference_lead_sources.sql — reference-based lead sources
-- ------------------------------------------------------------
-- Adds 'personal_reference' and 'old_student_reference' to the lead_source
-- enum, same additive pattern as 0020_website_lead_source.sql and
-- 0024_twitter_lead_source.sql. Staff-selected only (Create query dialog and
-- the lead editor) — never reachable from the public apply form, which has
-- no source field and keeps capturing utm_source automatically from the URL.
-- ============================================================

alter type lead_source add value if not exists 'personal_reference';
alter type lead_source add value if not exists 'old_student_reference';
