-- ============================================================
-- 0041_grading_grade_letter.sql — letter/division grades
-- ------------------------------------------------------------
-- Grading system dropdown drops "CGPA (out of 5.0)" and adds "Grade"
-- (letter/division grades like A, A-, First Division — free text, can't
-- live in the existing numeric(6,2) grade_value column). grade_letter is a
-- new, separate column used only when grading_system = 'grade'; grade_value
-- keeps serving cgpa_4/percentage/other exactly as before.
--
-- 'cgpa_5' stays a valid grading_system value at the DB level even though
-- it's no longer offered in the app's dropdown — existing leads/applications
-- that already have it must remain editable without being forced to change
-- that field first.
-- ============================================================

alter table leads
  add column if not exists grade_letter text;

alter table applications
  add column if not exists grade_letter text;

alter table leads drop constraint if exists leads_grading_system_chk;
alter table leads add constraint leads_grading_system_chk
  check (grading_system is null or grading_system in ('cgpa_4','cgpa_5','percentage','grade','other'));

alter table applications drop constraint if exists applications_grading_system_chk;
alter table applications add constraint applications_grading_system_chk
  check (grading_system is null or grading_system in ('cgpa_4','cgpa_5','percentage','grade','other'));

notify pgrst, 'reload schema';
