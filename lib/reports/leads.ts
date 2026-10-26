import { LEAD_STATUSES, STATUS_LABELS, SOURCE_LABELS, type LeadSource, type LeadStatus } from '@/lib/leads/display';
import { zonedDateKey, zonedYMD, type Range } from './time';

/**
 * Lead report for any date range — backs the monthly report and the
 * reporting-period report (same numbers, different range). Pure: the page
 * fetches the rows, this shapes them.
 */

export interface ReportLead {
  id: string;
  status: string;
  utm_source: string;
  /** Staff who created the lead; null = came in through the public form. */
  created_by: string | null;
  created_at: string;
}

export interface CountRow {
  /** Filter value for the clickable link (status / source / staff id / date). */
  key: string;
  label: string;
  count: number;
}

export interface StaffRow extends CountRow {
  fastResponses: number;
  converted: number;
}

export interface LeadReport {
  total: number;
  converted: number;
  /** Share (0–100) of leads first acted on within an hour of arriving. */
  responseRate: number;
  bySource: CountRow[];
  byStatus: CountRow[];
  byStaff: StaffRow[];
  /** One row per local day, oldest first (key = YYYY-MM-DD). */
  daily: CountRow[];
  /** One row per calendar month in the range (key = YYYY-MM). */
  monthly: CountRow[];
}

const HOUR = 60 * 60 * 1000;

export function buildLeadReport(
  leads: ReportLead[],
  opts: {
    tz: string;
    range: Range;
    /** Every local date in the range, so empty days still show as 0. */
    dayKeys: string[];
    /** lead id → first status change (ISO). */
    firstContact: Map<string, string>;
    /** Lead ids that have at least one application. */
    convertedIds: Set<string>;
    nameById: Map<string, string | null>;
  },
): LeadReport {
  const isFast = (l: ReportLead) => {
    const first = opts.firstContact.get(l.id);
    return !!first && new Date(first).getTime() - new Date(l.created_at).getTime() <= HOUR;
  };

  const sources = new Map<string, number>();
  const statuses = new Map<string, number>();
  const staff = new Map<string, StaffRow>();
  const days = new Map(opts.dayKeys.map((k) => [k, 0]));
  const months = new Map<string, number>();
  for (const k of opts.dayKeys) months.set(k.slice(0, 7), 0);

  let converted = 0;
  let fast = 0;
  for (const l of leads) {
    sources.set(l.utm_source, (sources.get(l.utm_source) ?? 0) + 1);
    statuses.set(l.status, (statuses.get(l.status) ?? 0) + 1);

    const key = l.created_by ?? 'none';
    const row = staff.get(key) ?? {
      key,
      label: l.created_by ? (opts.nameById.get(l.created_by) ?? 'Former staff') : 'Public form',
      count: 0,
      fastResponses: 0,
      converted: 0,
    };
    row.count++;
    const leadFast = isFast(l);
    const leadConverted = opts.convertedIds.has(l.id);
    if (leadFast) {
      row.fastResponses++;
      fast++;
    }
    if (leadConverted) {
      row.converted++;
      converted++;
    }
    staff.set(key, row);

    const day = zonedDateKey(new Date(l.created_at), opts.tz);
    if (days.has(day)) days.set(day, days.get(day)! + 1);
    const month = day.slice(0, 7);
    if (months.has(month)) months.set(month, months.get(month)! + 1);
  }

  const dayLabel = (key: string) =>
    new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  const monthLabel = (key: string) =>
    new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  return {
    total: leads.length,
    converted,
    responseRate: leads.length ? Math.round((fast / leads.length) * 100) : 0,
    bySource: [...sources.entries()]
      .map(([key, count]) => ({ key, label: SOURCE_LABELS[key as LeadSource] ?? key, count }))
      .sort((a, b) => b.count - a.count),
    byStatus: LEAD_STATUSES.map((s) => ({
      key: s,
      label: STATUS_LABELS[s as LeadStatus],
      count: statuses.get(s) ?? 0,
    })),
    byStaff: [...staff.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    daily: [...days.entries()].map(([key, count]) => ({ key, label: dayLabel(key), count })),
    monthly: [...months.entries()].map(([key, count]) => ({ key, label: monthLabel(key), count })),
  };
}

/** Percentage change, rounded; null when there's nothing to compare against. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Local-date YYYY-MM-DD bounds of a range, inclusive — for /leads?from=&to= links. */
export function rangeDateBounds(range: Range, tz: string): { from: string; to: string } {
  const last = zonedYMD(new Date(range.end.getTime() - 1), tz);
  return {
    from: zonedDateKey(range.start, tz),
    to: `${last.year}-${String(last.month).padStart(2, '0')}-${String(last.day).padStart(2, '0')}`,
  };
}
