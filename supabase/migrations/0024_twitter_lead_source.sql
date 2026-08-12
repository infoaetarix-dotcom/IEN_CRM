-- ============================================================
-- 0024_twitter_lead_source.sql — 'twitter' lead source
-- ------------------------------------------------------------
-- Adds 'twitter' to the lead_source enum, same additive pattern as
-- 0020_website_lead_source.sql. Needed for the per-platform tracked share
-- links on the Form tab (Instagram/Facebook/WhatsApp/LinkedIn/Twitter/
-- YouTube, each ?utm_source=<platform>) — without this, a Twitter link
-- would normalize to 'other' and lose the distinct tracking.
-- ============================================================

alter type lead_source add value if not exists 'twitter';
