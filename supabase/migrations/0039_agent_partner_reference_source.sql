-- ============================================================
-- 0039_agent_partner_reference_source.sql — new lead source
-- ------------------------------------------------------------
-- Adds 'agent_partner_reference' to the lead_source enum, same additive
-- pattern as 0020_website_lead_source.sql, 0024_twitter_lead_source.sql,
-- and 0031_reference_lead_sources.sql. Staff-selected only (Create query
-- dialog and the lead editor's manual Source dropdown) — reveals the
-- Name/Note reference fields the same way personal_reference and
-- old_student_reference already do (see lib/leads/display.ts).
-- ============================================================

alter type lead_source add value if not exists 'agent_partner_reference';
