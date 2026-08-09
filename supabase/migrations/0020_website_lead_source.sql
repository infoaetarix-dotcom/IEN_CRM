-- ============================================================
-- 0020_website_lead_source.sql — 'website' lead source
-- ------------------------------------------------------------
-- Adds a distinct 'website' value to the lead_source enum so leads
-- submitted through a consultancy's own website (embedded /{slug}/apply
-- iframe, or a linked-out button) are tagged separately from a 'direct'
-- visit to the app's own domain.
--
-- ALTER TYPE ... ADD VALUE must be its own statement — it cannot be used
-- in the same transaction that also reads/writes the new value. This
-- migration only adds it, so it's safe to run as-is.
-- ============================================================

alter type lead_source add value if not exists 'website';
