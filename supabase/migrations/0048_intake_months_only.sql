-- ============================================================
-- 0048_intake_months_only.sql — finish the intake switch-over (step 2 of 2)
-- ------------------------------------------------------------
-- RUN ONLY AFTER the code from 0047's release is live on production.
-- Until then the old code can still write old season values, and this
-- would make those writes fail.
--
-- 1. Convert any old-season rows written between 0047 and the deploy
--    (same mapping and legacy copy as 0047).
-- 2. Allow only the new intake values.
-- 3. Drop reporting_periods: lead reports now follow each lead's intake
--    field, so the hand-set periods from 0045 are no longer used.
--    (reporting_settings — the time zone — stays.)
-- ============================================================

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

alter table leads drop constraint if exists leads_intake_season_chk;
alter table leads add constraint leads_intake_season_chk
  check (intake_season is null or intake_season in ('jan_feb', 'apr_may', 'sep_oct'));

alter table applications drop constraint if exists applications_intake_season_chk;
alter table applications add constraint applications_intake_season_chk
  check (intake_season is null or intake_season in ('jan_feb', 'apr_may', 'sep_oct'));

drop table if exists reporting_periods;

notify pgrst, 'reload schema';
