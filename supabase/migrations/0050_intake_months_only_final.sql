-- ============================================================
-- 0050_intake_months_only_final.sql — lock intakes to the new values
-- ------------------------------------------------------------
-- RUN ONLY AFTER the code using Jan–Feb / Apr–May / Sep–Oct is live on
-- production (the release that follows 0047). Same as 0048's intake part,
-- re-applied because 0049 had to loosen it again while production still
-- ran the old code:
--   1. convert any old-season rows written in between (legacy copy kept);
--   2. allow only the new intake values.
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

notify pgrst, 'reload schema';
