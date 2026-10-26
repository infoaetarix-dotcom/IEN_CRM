import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_STAGE,
  type ApplicationStatus,
} from '@/lib/leads/display';

/**
 * Application intake report: the admissions funnel for one intake season.
 *
 * Only an application's *current* status is stored (there's no application
 * status history), so milestones are counted by what an application has
 * *reached*: one now at "Visa accepted" has necessarily applied for its
 * visa too, so it counts under "Visa applied" as well. Each milestone lists
 * the current statuses that imply it.
 */

const AFTER_OFFER: ApplicationStatus[] = [
  'deposit_1_paid',
  'deposit_2_paid',
  'cas_coe_i20_received',
  'deposit_rejected',
  'deposit_deferred',
  'deposit_refunded',
];
const VISA_STAGE: ApplicationStatus[] = ['visa_submitted', 'visa_accepted', 'visa_rejected', 'visa_refunded'];

export interface Milestone {
  key: string;
  label: string;
  /** Current statuses that mean an application has reached this milestone. */
  statuses: ApplicationStatus[];
  /** Bad outcomes are shown in red. */
  tone?: 'bad';
}

export const MILESTONES: Milestone[] = [
  { key: 'generated', label: 'Applications generated', statuses: [...APPLICATION_STATUSES] },
  {
    key: 'offer',
    label: 'Offers received',
    statuses: ['conditional_offer', 'unconditional_offer', ...AFTER_OFFER, ...VISA_STAGE, 'enrolled'],
  },
  {
    key: 'deposit',
    label: 'Deposit paid',
    statuses: ['deposit_1_paid', 'deposit_2_paid', 'cas_coe_i20_received', 'deposit_refunded', ...VISA_STAGE, 'enrolled'],
  },
  { key: 'cas', label: 'CAS / COE / I-20 received', statuses: ['cas_coe_i20_received', ...VISA_STAGE, 'enrolled'] },
  { key: 'visa_applied', label: 'Visa applied', statuses: [...VISA_STAGE, 'enrolled'] },
  { key: 'visa_accepted', label: 'Visa accepted', statuses: ['visa_accepted', 'enrolled'] },
  { key: 'visa_rejected', label: 'Visa rejected', statuses: ['visa_rejected'], tone: 'bad' },
  { key: 'enrolled', label: 'Students enrolled', statuses: ['enrolled'] },
  { key: 'app_rejected', label: 'Rejected by university', statuses: ['app_rejected'], tone: 'bad' },
  {
    key: 'deferred',
    label: 'Deferred',
    statuses: ['app_deferred', 'deposit_deferred'],
  },
];

export interface IntakeApplication {
  status: string;
  university_name: string | null;
  country: string | null;
}

export interface BreakdownRow {
  label: string;
  total: number;
  visaApplied: number;
  visaAccepted: number;
  visaRejected: number;
}

export interface IntakeReport {
  total: number;
  milestones: (Milestone & { count: number })[];
  byStatus: { status: ApplicationStatus; label: string; stage: string; count: number }[];
  /** Accepted ÷ decided (accepted + rejected), 0–100; null when nothing is decided yet. */
  visaSuccessRate: number | null;
  byUniversity: BreakdownRow[];
  byCountry: BreakdownRow[];
}

function inStatuses(status: string, list: ApplicationStatus[]) {
  return (list as string[]).includes(status);
}

function breakdown(apps: IntakeApplication[], keyOf: (a: IntakeApplication) => string): BreakdownRow[] {
  const visaApplied = MILESTONES.find((m) => m.key === 'visa_applied')!.statuses;
  const visaAccepted = MILESTONES.find((m) => m.key === 'visa_accepted')!.statuses;
  const rows = new Map<string, BreakdownRow>();
  for (const a of apps) {
    const label = keyOf(a);
    const row = rows.get(label) ?? { label, total: 0, visaApplied: 0, visaAccepted: 0, visaRejected: 0 };
    row.total++;
    if (inStatuses(a.status, visaApplied)) row.visaApplied++;
    if (inStatuses(a.status, visaAccepted)) row.visaAccepted++;
    if (a.status === 'visa_rejected') row.visaRejected++;
    rows.set(label, row);
  }
  return [...rows.values()].sort((x, y) => y.total - x.total || x.label.localeCompare(y.label));
}

export function buildIntakeReport(apps: IntakeApplication[]): IntakeReport {
  const milestones = MILESTONES.map((m) => ({
    ...m,
    count: apps.filter((a) => inStatuses(a.status, m.statuses)).length,
  }));
  const byStatus = APPLICATION_STATUSES.map((status) => ({
    status,
    label: APPLICATION_STATUS_LABELS[status],
    stage: APPLICATION_STATUS_STAGE[status],
    count: apps.filter((a) => a.status === status).length,
  }));
  const accepted = milestones.find((m) => m.key === 'visa_accepted')!.count;
  const rejected = milestones.find((m) => m.key === 'visa_rejected')!.count;
  return {
    total: apps.length,
    milestones,
    byStatus,
    visaSuccessRate: accepted + rejected > 0 ? Math.round((accepted / (accepted + rejected)) * 100) : null,
    byUniversity: breakdown(apps, (a) => a.university_name ?? 'No university'),
    byCountry: breakdown(apps, (a) => a.country ?? 'Unknown'),
  };
}
