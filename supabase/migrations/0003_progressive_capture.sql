-- =========================================================
-- 0003 — Progressive capture (multi-step form)
-- The public form becomes a 3-step wizard that saves the lead after
-- step 1, then enriches it. Two columns support this:
--   submission_token — unguessable token returned to the browser after
--     step 1; required to update the lead in later steps (so a public
--     visitor can only edit the lead they just created).
--   is_complete      — false while mid-wizard, true once finished. Lets
--     staff spot & follow up on partially-completed (abandoned) leads.
-- Run in the Supabase SQL editor AFTER 0002.
-- =========================================================

alter table leads
  add column if not exists submission_token uuid not null default gen_random_uuid(),
  add column if not exists is_complete       boolean not null default true;

-- Existing leads were single-submit → already complete (default true).

create index if not exists idx_leads_incomplete on leads(is_complete) where is_complete = false;

notify pgrst, 'reload schema';
