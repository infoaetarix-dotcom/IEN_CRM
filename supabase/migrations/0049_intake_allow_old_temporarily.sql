-- ============================================================
-- 0049_intake_allow_old_temporarily.sql — undo 0048's intake lock until
-- the new code is live
-- ------------------------------------------------------------
-- 0048 was run before the code that uses the new intakes was deployed.
-- Production still offers the old seasons (spring/summer/fall/winter), so
-- with 0048's constraint every save that includes an intake failed —
-- public-form step 3, creating an application, editing a lead.
--
-- This re-allows old AND new values (same as 0047), so production works
-- again. Data is untouched. Once the new code is live, run 0050, which
-- converts any old-season rows written in between and locks the column
-- to the new values for good.
--
-- (0048 also dropped reporting_periods; nothing needs it back — the old
-- code treats a missing table as "no periods" and the new code no longer
-- uses it.)
-- ============================================================

alter table leads drop constraint if exists leads_intake_season_chk;
alter table leads add constraint leads_intake_season_chk
  check (intake_season is null or intake_season in
    ('jan_feb', 'apr_may', 'sep_oct', 'spring', 'summer', 'fall', 'winter'));

alter table applications drop constraint if exists applications_intake_season_chk;
alter table applications add constraint applications_intake_season_chk
  check (intake_season is null or intake_season in
    ('jan_feb', 'apr_may', 'sep_oct', 'spring', 'summer', 'fall', 'winter'));

notify pgrst, 'reload schema';
