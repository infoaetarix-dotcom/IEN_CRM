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
  'twitter',
  'website',
  'personal_reference',
  'old_student_reference',
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
  direct: 'Direct',
  other: 'Other',
};

/**
 * The two staff-only sources that ask for who referred the lead — picking
 * either one in the Create query dialog or the lead editor reveals a Name +
 * Note pair that gets logged as a note (see composeReferenceNote) rather
 * than stored as its own column.
 */
export const REFERENCE_SOURCES = ['personal_reference', 'old_student_reference'] as const;

export function isReferenceSource(v: string): boolean {
  return (REFERENCE_SOURCES as readonly string[]).includes(v);
}

/** Combine the reference Name + Note fields into one note body; '' if both are blank. */
export function composeReferenceNote(name: string, note: string): string {
  const parts: string[] = [];
  if (name.trim()) parts.push(`Referred by: ${name.trim()}`);
  if (note.trim()) parts.push(note.trim());
  return parts.join('\n\n');
}

export function isLeadStatus(v: string): v is LeadStatus {
  return (LEAD_STATUSES as readonly string[]).includes(v);
}
