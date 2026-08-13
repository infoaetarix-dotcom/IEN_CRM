-- ============================================================
-- 0026_drop_finance_entries_lead_id.sql — remove the unused lead link
-- ------------------------------------------------------------
-- finance_entries (0019) is the private per-admin ledger ("My Finance").
-- It used to optionally link an entry to a lead; that option was removed
-- from the app (no code reads, writes, or filters on this column anymore —
-- see 0025's comment for context on why: student-linked payments now belong
-- in the separate, shared student_finance_entries table instead).
--
-- SAFE: verified zero application code references finance_entries.lead_id,
-- the RLS policy (finance_entries_own) never checked it, and the table has
-- 0 rows with a lead_id set at the time this was written — nothing to lose.
-- ============================================================

alter table finance_entries drop column if exists lead_id;

notify pgrst, 'reload schema';
