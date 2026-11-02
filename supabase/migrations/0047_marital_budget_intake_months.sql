-- ============================================================
-- 0047_marital_budget_intake_months.sql — marital status, budget range,
-- and intakes as month pairs (step 1 of 2)
-- ------------------------------------------------------------
-- 1. marital_status (single / married / prefer_not_to_say) and
--    budget_range (PKR lakh/crore bands) on leads and applications.
--    Both optional at the database level; the public form requires
--    marital status in the app (lib/validation/lead.ts).
--
-- 2. Intake: the old seasons (spring/summer/fall/winter) become the
--    consultancy's real intakes — jan_feb, apr_may, sep_oct. The column
--    keeps its name (intake_season) to avoid touching every query; only
--    its values change. Existing rows are converted:
--      winter → jan_feb    spring → apr_may
--      summer → apr_may    fall   → sep_oct
--    Each converted row keeps its original season in intake_season_legacy,
--    so the mapping can be corrected later if a season was meant
--    differently (e.g. if "spring" should have been Jan–Feb).
--
-- SAFE ON THE LIVE SITE: the CHECK constraints accept BOTH the old and
-- new values for now, because production keeps writing old seasons until
-- the new code is deployed. 0048 (run AFTER the new code is live)
-- converts any stragglers and then allows only the new values.
-- ============================================================

alter table leads
  add column if not exists marital_status       text,
  add column if not exists budget_range         text,
  add column if not exists intake_season_legacy text;

alter table applications
  add column if not exists marital_status       text,
  add column if not exists budget_range         text,
  add column if not exists intake_season_legacy text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_marital_status_chk') then
    alter table leads add constraint leads_marital_status_chk
      check (marital_status is null or marital_status in ('single', 'married', 'prefer_not_to_say'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'leads_budget_range_chk') then
    alter table leads add constraint leads_budget_range_chk
      check (budget_range is null or budget_range in
        ('below_10l', '10l_20l', '20l_30l', '30l_50l', '50l_1cr', 'above_1cr', 'not_sure'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'applications_marital_status_chk') then
    alter table applications add constraint applications_marital_status_chk
      check (marital_status is null or marital_status in ('single', 'married', 'prefer_not_to_say'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'applications_budget_range_chk') then
    alter table applications add constraint applications_budget_range_chk
      check (budget_range is null or budget_range in
        ('below_10l', '10l_20l', '20l_30l', '30l_50l', '50l_1cr', 'above_1cr', 'not_sure'));
  end if;
end $$;

-- Intake: allow old + new during the switch-over.
alter table leads drop constraint if exists leads_intake_season_chk;
alter table leads add constraint leads_intake_season_chk
  check (intake_season is null or intake_season in
    ('jan_feb', 'apr_may', 'sep_oct', 'spring', 'summer', 'fall', 'winter'));

alter table applications drop constraint if exists applications_intake_season_chk;
alter table applications add constraint applications_intake_season_chk
  check (intake_season is null or intake_season in
    ('jan_feb', 'apr_may', 'sep_oct', 'spring', 'summer', 'fall', 'winter'));

-- Keep the original season, then convert.
update leads set intake_season_legacy = intake_season
  where intake_season in ('spring', 'summer', 'fall', 'winter') and intake_season_legacy is null;
update leads set intake_season = case intake_season
    when 'winter' then 'jan_feb'
    when 'spring' then 'apr_may'
    when 'summer' then 'apr_may'
    when 'fall'   then 'sep_oct'
  end
  where intake_season in ('spring', 'summer', 'fall', 'winter');

update applications set intake_season_legacy = intake_season
  where intake_season in ('spring', 'summer', 'fall', 'winter') and intake_season_legacy is null;
update applications set intake_season = case intake_season
    when 'winter' then 'jan_feb'
    when 'spring' then 'apr_may'
    when 'summer' then 'apr_may'
    when 'fall'   then 'sep_oct'
  end
  where intake_season in ('spring', 'summer', 'fall', 'winter');

notify pgrst, 'reload schema';
