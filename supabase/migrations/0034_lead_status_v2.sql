-- ============================================================
-- 0034_lead_status_v2.sql — Collapse lead status to 4 stages
-- ------------------------------------------------------------
-- Leads' status simplifies from 6 values (new/contacted/in_progress/
-- follow_up/accepted/rejected) to 4 (raw_lead/document_processing/
-- application_generated/rejected). Applications deliberately keep the OLD
-- `lead_status` enum completely untouched — an application's own status is
-- a different concept (its progress through a specific application, not
-- the lead's journey toward becoming one) and was never part of this
-- request; see app/(admin)/applications/actions.ts / application-controls.tsx,
-- which still validate against the original 6 values.
--
-- Mapping applied to every existing row:
--   new, contacted         -> raw_lead
--   in_progress, follow_up -> document_processing
--   accepted               -> application_generated
--   rejected                -> rejected
--
-- lead_status_history is written exclusively by lead status changes (never
-- by applications — updateApplicationStatus has no history insert), so its
-- from_status/to_status columns move to the new type too, remapped the
-- same way.
--
-- SAFE ON A LIVE TABLE: creates a new enum type and swaps three columns
-- onto it with a USING remap. The original `lead_status` enum is left
-- exactly as it was — applications.status still uses it.
-- ============================================================

create type lead_stage as enum ('raw_lead', 'document_processing', 'application_generated', 'rejected');

alter table leads alter column status drop default;

alter table leads
  alter column status type lead_stage
  using (
    case status::text
      when 'new' then 'raw_lead'
      when 'contacted' then 'raw_lead'
      when 'in_progress' then 'document_processing'
      when 'follow_up' then 'document_processing'
      when 'accepted' then 'application_generated'
      when 'rejected' then 'rejected'
    end
  )::lead_stage;

alter table leads alter column status set default 'raw_lead';

alter table lead_status_history
  alter column from_status type lead_stage
  using (
    case from_status::text
      when 'new' then 'raw_lead'
      when 'contacted' then 'raw_lead'
      when 'in_progress' then 'document_processing'
      when 'follow_up' then 'document_processing'
      when 'accepted' then 'application_generated'
      when 'rejected' then 'rejected'
      else null
    end
  )::lead_stage;

alter table lead_status_history
  alter column to_status type lead_stage
  using (
    case to_status::text
      when 'new' then 'raw_lead'
      when 'contacted' then 'raw_lead'
      when 'in_progress' then 'document_processing'
      when 'follow_up' then 'document_processing'
      when 'accepted' then 'application_generated'
      when 'rejected' then 'rejected'
    end
  )::lead_stage;

notify pgrst, 'reload schema';
