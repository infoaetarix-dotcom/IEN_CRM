-- ============================================================
-- 0040_google_profile_source.sql — new lead source
-- ------------------------------------------------------------
-- Adds 'google_profile' to the lead_source enum, same additive pattern as
-- every prior source addition (0020, 0024, 0031, 0039). Not a reference
-- source — like instagram/facebook/etc., it gets its own tracked link on
-- the Form tab (components/dashboard/social-source-links.tsx) rather than
-- asking who referred the lead.
-- ============================================================

alter type lead_source add value if not exists 'google_profile';
