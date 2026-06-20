// Shared display metadata for lead status & source — keeps labels/colors
// consistent across the table, detail page, and charts.

export const LEAD_STATUSES = [
  'new',
  'contacted',
  'in_progress',
  'accepted',
  'rejected',
  'follow_up',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  in_progress: 'In progress',
  accepted: 'Accepted',
  rejected: 'Rejected',
  follow_up: 'Follow-up',
};

export const STATUS_BADGE: Record<
  LeadStatus,
  'info' | 'accent' | 'warning' | 'success' | 'danger' | 'neutral'
> = {
  new: 'info',
  contacted: 'accent',
  in_progress: 'warning',
  accepted: 'success',
  rejected: 'danger',
  follow_up: 'neutral',
};

export const LEAD_SOURCES = [
  'instagram',
  'facebook',
  'linkedin',
  'youtube',
  'whatsapp',
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
  direct: 'Direct',
  other: 'Other',
};

export function isLeadStatus(v: string): v is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(v);
}
