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
 * An application's own status (applications.status, still the original
 * `lead_status` enum) — a separate, unchanged set. Applications track a
 * specific application's progress, not the lead's journey toward becoming
 * one, so this was deliberately left alone when LEAD_STATUSES collapsed to
 * 4 stages (see 0034_lead_status_v2.sql).
 */
export const APPLICATION_STATUSES = [
  'new',
  'contacted',
  'in_progress',
  'accepted',
  'rejected',
  'follow_up',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  in_progress: 'In progress',
  accepted: 'Accepted',
  rejected: 'Rejected',
  follow_up: 'Follow-up',
};

export const APPLICATION_STATUS_BADGE: Record<
  ApplicationStatus,
  'info' | 'accent' | 'warning' | 'success' | 'danger' | 'neutral'
> = {
  new: 'info',
  contacted: 'accent',
  in_progress: 'warning',
  accepted: 'success',
  rejected: 'danger',
  follow_up: 'neutral',
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
