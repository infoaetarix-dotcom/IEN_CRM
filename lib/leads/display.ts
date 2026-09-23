// Shared display metadata for lead status & source — keeps labels/colors
// consistent across the table, detail page, and charts.

/**
 * A lead's own pipeline stage (leads.status, type `lead_stage` — see
 * 0034_lead_status_v2.sql). Deliberately just 4 values: staff move a lead
 * through them, not the finer-grained per-application status below.
 */
export const LEAD_STATUSES = [
  'raw_lead',
  'document_processing',
  'application_generated',
  'rejected',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  raw_lead: 'Raw lead',
  document_processing: 'Document processing',
  application_generated: 'Application generated',
  rejected: 'Rejected',
};

export const STATUS_BADGE: Record<
  LeadStatus,
  'info' | 'accent' | 'warning' | 'success' | 'danger' | 'neutral'
> = {
  raw_lead: 'info',
  document_processing: 'warning',
  application_generated: 'success',
  rejected: 'danger',
};

/**
 * An application's own status (applications.status) — a separate concept
 * from a lead's journey toward becoming one (LEAD_STATUSES above). This is
 * the client's real 4-stage admissions pipeline (see
 * 0044_application_stage_statuses.sql): Application -> Fee Deposit -> Visa
 * -> Enrollment, each with its own set of specific outcomes. Rejected/
 * Deferred/Refunded are stage-specific (e.g. app_rejected vs
 * deposit_rejected) so staff can tell *where* an application fell out,
 * not just that it did.
 */
export const APPLICATION_STAGES = ['application', 'fee_deposit', 'visa', 'enrollment'] as const;
export type ApplicationStage = (typeof APPLICATION_STAGES)[number];

export const APPLICATION_STAGE_LABELS: Record<ApplicationStage, string> = {
  application: 'Application',
  fee_deposit: 'Fee Deposit',
  visa: 'Visa',
  enrollment: 'Enrolled',
};

export const APPLICATION_STATUSES = [
  // Stage 1: Application
  'applied_processed',
  'conditional_offer',
  'unconditional_offer',
  'interview_assessment',
  'pci_gte_interview',
  'app_rejected',
  'app_deferred',
  // Stage 2: Fee Deposit
  'deposit_1_paid',
  'deposit_2_paid',
  'cas_coe_i20_received',
  'deposit_rejected',
  'deposit_deferred',
  'deposit_refunded',
  // Stage 3: Visa
  'visa_submitted',
  'visa_accepted',
  'visa_rejected',
  'visa_refunded',
  // Stage 4: Enrollment
  'enrolled',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  applied_processed: 'Applied / Processed',
  conditional_offer: 'Conditional Offer',
  unconditional_offer: 'Unconditional Offer',
  interview_assessment: 'Interview / Assessment Required',
  pci_gte_interview: 'PCI / GTE Interview',
  app_rejected: 'Rejected — Application',
  app_deferred: 'Deferred — Application',
  deposit_1_paid: 'Deposit 1 Paid',
  deposit_2_paid: 'Deposit 2 Paid',
  cas_coe_i20_received: 'CAS / COE / I-20 Received',
  deposit_rejected: 'Rejected — Fee Deposit',
  deposit_deferred: 'Deferred — Fee Deposit',
  deposit_refunded: 'Refunded — Fee Deposit',
  visa_submitted: 'Visa Application Submitted',
  visa_accepted: 'Visa Accepted',
  visa_rejected: 'Visa Rejected',
  visa_refunded: 'Refunded — Visa',
  enrolled: 'Student Enrolled',
};

export const APPLICATION_STATUS_STAGE: Record<ApplicationStatus, ApplicationStage> = {
  applied_processed: 'application',
  conditional_offer: 'application',
  unconditional_offer: 'application',
  interview_assessment: 'application',
  pci_gte_interview: 'application',
  app_rejected: 'application',
  app_deferred: 'application',
  deposit_1_paid: 'fee_deposit',
  deposit_2_paid: 'fee_deposit',
  cas_coe_i20_received: 'fee_deposit',
  deposit_rejected: 'fee_deposit',
  deposit_deferred: 'fee_deposit',
  deposit_refunded: 'fee_deposit',
  visa_submitted: 'visa',
  visa_accepted: 'visa',
  visa_rejected: 'visa',
  visa_refunded: 'visa',
  enrolled: 'enrollment',
};

/** Statuses grouped by stage, in display order — backs the grouped status dropdown. */
export const APPLICATION_STATUSES_BY_STAGE: Record<ApplicationStage, ApplicationStatus[]> = (() => {
  const out = { application: [], fee_deposit: [], visa: [], enrollment: [] } as Record<
    ApplicationStage,
    ApplicationStatus[]
  >;
  for (const s of APPLICATION_STATUSES) out[APPLICATION_STATUS_STAGE[s]].push(s);
  return out;
})();

export const APPLICATION_STATUS_BADGE: Record<
  ApplicationStatus,
  'info' | 'accent' | 'warning' | 'success' | 'danger' | 'neutral'
> = {
  applied_processed: 'info',
  conditional_offer: 'accent',
  unconditional_offer: 'accent',
  interview_assessment: 'warning',
  pci_gte_interview: 'warning',
  app_rejected: 'danger',
  app_deferred: 'neutral',
  deposit_1_paid: 'info',
  deposit_2_paid: 'accent',
  cas_coe_i20_received: 'success',
  deposit_rejected: 'danger',
  deposit_deferred: 'neutral',
  deposit_refunded: 'neutral',
  visa_submitted: 'info',
  visa_accepted: 'success',
  visa_rejected: 'danger',
  visa_refunded: 'neutral',
  enrolled: 'success',
};

export function isApplicationStatus(v: string): v is ApplicationStatus {
  return (APPLICATION_STATUSES as readonly string[]).includes(v);
}

export const LEAD_SOURCES = [
  'instagram',
  'facebook',
  'linkedin',
  'youtube',
  'whatsapp',
  'twitter',
  'website',
  'google_profile',
  'personal_reference',
  'old_student_reference',
  'agent_partner_reference',
  'direct',
  'other',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const SOURCE_LABELS: Record<LeadSource, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  twitter: 'Twitter / X',
  website: 'Website',
  google_profile: 'Google Profile',
  personal_reference: 'Personal reference',
  old_student_reference: 'Old student reference',
  agent_partner_reference: 'Agent/Partner reference',
  direct: 'Direct',
  other: 'Other',
};

/**
 * The staff-only sources that ask for who referred the lead — picking any
 * of these in the Create query dialog or the lead editor reveals the
 * persistent Name + Note fields (leads.reference_name/reference_note, see
 * 0032_lead_reference_and_passport.sql).
 */
export const REFERENCE_SOURCES = [
  'personal_reference',
  'old_student_reference',
  'agent_partner_reference',
] as const;

export function isReferenceSource(v: string): boolean {
  return (REFERENCE_SOURCES as readonly string[]).includes(v);
}

export function isLeadStatus(v: string): v is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(v);
}
