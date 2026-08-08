-- ============================================================
-- 0017_more_org_themes.sql — 3 more color theme presets
-- ------------------------------------------------------------
-- Extends the theme_key check from 0016_org_theme.sql to accept 3 new
-- presets (definitions in lib/branding/themes.ts):
--   emerald-growth   — navy & green
--   crimson-scholar  — maroon & red
--   slate-indigo     — charcoal & indigo
--
-- No data changes — existing orgs keep whatever theme_key they already have.
-- SAFE ON A LIVE TABLE: constraint-only change.
-- ============================================================

alter table organizations
  drop constraint if exists organizations_theme_key_check;
alter table organizations
  add constraint organizations_theme_key_check
  check (theme_key in (
    'aetarix-default',
    'classic-editorial',
    'emerald-growth',
    'crimson-scholar',
    'slate-indigo'
  ));
