-- =========================================================
-- 0002 — Extended lead fields (location, prior education,
-- experience, English proficiency, intake, funding).
-- All nullable (optional on the form). Categorical fields use
-- CHECK constraints so values stay standardized for analytics
-- even if application validation were ever bypassed.
-- Run in Supabase SQL editor AFTER 0001_init.sql.
-- =========================================================

alter table leads
  -- Location
  add column if not exists city                  text,
  add column if not exists district              text,

  -- Prior education
  add column if not exists last_qualification    text,
  add column if not exists prior_institution     text,
  add column if not exists passing_year          smallint,
  add column if not exists grading_system        text,
  add column if not exists grade_value           numeric(6,2),

  -- Experience
  add column if not exists work_experience_years smallint,
  add column if not exists work_experience_detail text,

  -- English proficiency
  add column if not exists english_test          text,
  add column if not exists english_score         numeric(4,1),

  -- Intended intake
  add column if not exists intake_season         text,
  add column if not exists intake_year           smallint,

  -- Funding
  add column if not exists funding_source        text;

-- ---- CHECK constraints (standardized values / sane ranges) ----
-- Wrapped so re-running is safe.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_passing_year_chk') then
    alter table leads add constraint leads_passing_year_chk
      check (passing_year is null or passing_year between 1950 and (extract(year from now())::int + 1));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'leads_grading_system_chk') then
    alter table leads add constraint leads_grading_system_chk
      check (grading_system is null or grading_system in ('cgpa_4','cgpa_5','percentage','other'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'leads_grade_value_chk') then
    alter table leads add constraint leads_grade_value_chk
      check (
        grade_value is null or grading_system is null
        or (grading_system = 'cgpa_4'     and grade_value >= 0 and grade_value <= 4.0)
        or (grading_system = 'cgpa_5'     and grade_value >= 0 and grade_value <= 5.0)
        or (grading_system = 'percentage' and grade_value >= 0 and grade_value <= 100)
        or (grading_system = 'other'      and grade_value >= 0)
      );
  end if;

  if not exists (select 1 from pg_constraint where conname = 'leads_work_years_chk') then
    alter table leads add constraint leads_work_years_chk
      check (work_experience_years is null or work_experience_years between 0 and 60);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'leads_english_test_chk') then
    alter table leads add constraint leads_english_test_chk
      check (english_test is null or english_test in ('ielts','toefl','pte','duolingo','planned','none'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'leads_english_score_chk') then
    alter table leads add constraint leads_english_score_chk
      check (english_score is null or (english_score >= 0 and english_score <= 120));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'leads_intake_season_chk') then
    alter table leads add constraint leads_intake_season_chk
      check (intake_season is null or intake_season in ('spring','summer','fall','winter'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'leads_intake_year_chk') then
    alter table leads add constraint leads_intake_year_chk
      check (intake_year is null or intake_year between 2024 and 2035);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'leads_funding_source_chk') then
    alter table leads add constraint leads_funding_source_chk
      check (funding_source is null or funding_source in ('self','family','loan','scholarship','employer','other'));
  end if;
end $$;

-- Helpful indexes for future analytics/filtering.
create index if not exists idx_leads_intake     on leads(intake_year, intake_season);
create index if not exists idx_leads_english     on leads(english_test);

notify pgrst, 'reload schema';
