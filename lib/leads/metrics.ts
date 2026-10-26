import {
  LEAD_STATUSES,
  STATUS_LABELS,
  LEAD_SOURCES,
  SOURCE_LABELS,
  type LeadStatus,
  type LeadSource,
} from './display';
import { zonedYMD, zonedDateKey, startOfDayInZone } from '@/lib/reports/time';

export interface LeadRow {
  status: string;
  utm_source: string;
  created_at: string;
}

export interface Datum {
  /** Filter value behind the bar/point (source, status or date), for click-through. */
  key?: string;
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
      key: s,
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
    key: s,
    label: STATUS_LABELS[s as LeadStatus],
    value: counts.get(s) ?? 0,
  }));
}

/**
 * Daily lead volume for the last `days` days, oldest → newest, bucketed by
 * the local date in `tz` (the org's reporting zone). `key` is that date
 * (YYYY-MM-DD), used for the chart's click-through to /leads.
 */
export function buildVolumeData(
  leads: LeadRow[],
  days = 14,
  now: Date = new Date(),
  tz = 'UTC',
): Datum[] {
  const today = zonedYMD(now, tz);
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    keys.push(zonedDateKey(startOfDayInZone(tz, today.year, today.month, today.day - i), tz));
  }
  const buckets = new Map(keys.map((k) => [k, 0]));
  for (const l of leads) {
    const key = zonedDateKey(new Date(l.created_at), tz);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  return keys.map((key) => ({
    key,
    // Keys are plain calendar dates; formatting them in UTC keeps the label
    // from shifting a day on machines behind UTC.
    label: new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC',
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
