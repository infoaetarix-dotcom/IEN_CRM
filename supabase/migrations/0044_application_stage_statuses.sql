-- ============================================================
-- 0044_application_stage_statuses.sql — real admissions-funnel statuses
-- ------------------------------------------------------------
-- Replaces applications.status's generic 6-value CRM enum (new/contacted/
-- in_progress/accepted/rejected/follow_up) with the client's actual
-- 4-stage admissions pipeline: Application -> Fee Deposit -> Visa ->
-- Enrollment, 17 specific statuses total. The UI groups these by stage
-- (lib/leads/display.ts's APPLICATION_STATUS_STAGE) for the status
-- dropdown and the applications page's stage tabs.
--
-- applications.status was still on the *original* lead_status enum (see
-- 0034_lead_status_v2.sql's note — leads moved to lead_stage, applications
-- deliberately did not). Same technique as that migration: new enum type,
-- swap the column, remap existing rows via USING.
--
-- Existing data has no reliable 1:1 mapping (the old statuses are far
-- coarser than the new ones), so this maps everything to a safe, neutral
-- landing spot rather than guessing a specific stage-status wrong:
--   new, contacted, in_progress, follow_up -> applied_processed
--   accepted                               -> unconditional_offer
--   rejected                               -> app_rejected
-- Staff should re-check and correct each existing application's real
-- status after this runs — a one-time manual pass (17 applications as of
-- writing this).
-- ============================================================

create type application_status_v2 as enum (
  -- Stage 1: Application
  'applied_processed',
  'conditional_offer',
  'unconditional_offer',
  'interview_assessment',
  'pci_gte_interview',
  'app_rejected',
  'app_deferred',
  -- Stage 2: Fee Deposit
  'deposit_1_paid',
  'deposit_2_paid',
  'cas_coe_i20_received',
  'deposit_rejected',
  'deposit_deferred',
  'deposit_refunded',
  -- Stage 3: Visa
  'visa_submitted',
  'visa_accepted',
  'visa_rejected',
  'visa_refunded',
  -- Stage 4: Enrollment
  'enrolled'
);

alter table applications alter column status drop default;

alter table applications
  alter column status type application_status_v2
  using (
    case status::text
      when 'new' then 'applied_processed'
      when 'contacted' then 'applied_processed'
      when 'in_progress' then 'applied_processed'
      when 'follow_up' then 'applied_processed'
      when 'accepted' then 'unconditional_offer'
      when 'rejected' then 'app_rejected'
    end
  )::application_status_v2;

alter table applications alter column status set default 'applied_processed';

notify pgrst, 'reload schema';
