import {
  LEAD_STATUSES,
  STATUS_LABELS,
  LEAD_SOURCES,
  SOURCE_LABELS,
  type LeadStatus,
  type LeadSource,
} from './display';

export interface LeadRow {
  status: string;
  utm_source: string;
  created_at: string;
}

export interface Datum {
  label: string;
  value: number;
}

/** Counts per source, only including sources that have at least one lead. */
export function buildSourceData(leads: LeadRow[]): Datum[] {
  const counts = new Map<string, number>();
  for (const l of leads) {
    counts.set(l.utm_source, (counts.get(l.utm_source) ?? 0) + 1);
  }
  return LEAD_SOURCES.filter((s) => counts.get(s))
    .map((s) => ({
      label: SOURCE_LABELS[s as LeadSource],
      value: counts.get(s) ?? 0,
    }));
}

/** Counts per pipeline status (all statuses shown, including zeros). */
export function buildPipelineData(leads: LeadRow[]): Datum[] {
  const counts = new Map<string, number>();
  for (const l of leads) {
    counts.set(l.status, (counts.get(l.status) ?? 0) + 1);
  }
  return LEAD_STATUSES.map((s) => ({
    label: STATUS_LABELS[s as LeadStatus],
    value: counts.get(s) ?? 0,
  }));
}

/** Daily lead volume for the last `days` days, oldest → newest. */
export function buildVolumeData(
  leads: LeadRow[],
  days = 14,
  now: Date = new Date(),
): Datum[] {
  const buckets = new Map<string, number>();
  const labels: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, 0);
    labels.push(key);
  }
  for (const l of leads) {
    const key = l.created_at.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return labels.map((key) => ({
    label: new Date(key).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
    }),
    value: buckets.get(key) ?? 0,
  }));
}

/**
 * Response rate = share of leads (in the given set) whose first transition to
 * "contacted" happened within `withinMs` of creation. firstContactByLead maps
 * lead id → ISO timestamp of first 'contacted' status change.
 */
export function computeResponseRate(
  leads: { id: string; created_at: string }[],
  firstContactByLead: Map<string, string>,
  withinMs = 60 * 60 * 1000,
): { rate: number | null; within: number; denom: number } {
  if (leads.length === 0) return { rate: null, within: 0, denom: 0 };
  let within = 0;
  for (const l of leads) {
    const contactedAt = firstContactByLead.get(l.id);
    if (!contactedAt) continue;
    const delta =
      new Date(contactedAt).getTime() - new Date(l.created_at).getTime();
    if (delta >= 0 && delta <= withinMs) within++;
  }
  return {
    rate: Math.round((within / leads.length) * 100),
    within,
    denom: leads.length,
  };
}
