-- ============================================================
-- 0016_org_theme.sql — per-tenant color theme
-- ------------------------------------------------------------
-- Each consultancy can now pick a color theme for their staff-facing
-- surfaces (admin panel, login, forgot/change/update password). Themes
-- themselves are a small, curated set defined in code
-- (lib/branding/themes.ts) — this column just stores which one an org
-- picked. Unknown/blank/never-set → the app falls back to
-- 'aetarix-default' in code, so this is safe to roll out gradually.
--
-- 'classic-editorial' is the navy-and-gold look this app used before the
-- current navy/blue redesign — kept as a selectable theme (not deleted)
-- so IEN, the existing client, can stay on the look they're used to while
-- new consultancies get the new default.
--
-- SAFE ON A LIVE TABLE: additive, nullable-with-default. Existing orgs
-- keep working and default to 'aetarix-default'.
-- ============================================================

alter table organizations
  add column if not exists theme_key text not null default 'aetarix-default';

-- Keep this in sync with THEME_KEYS in lib/branding/themes.ts.
alter table organizations
  drop constraint if exists organizations_theme_key_check;
alter table organizations
  add constraint organizations_theme_key_check
  check (theme_key in ('aetarix-default', 'classic-editorial'));

-- IEN keeps the look they've always had, for a clean side-by-side test of
-- per-tenant theming against a brand-new consultancy on the new default.
update organizations
  set theme_key = 'classic-editorial'
  where slug = 'ien';
