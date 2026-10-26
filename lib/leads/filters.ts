// Shared leads list-filter logic — used by the /leads page and the Excel
// export route so the two can never drift apart on what a given filter means.

import { isLeadStatus } from '@/lib/leads/display';
import { dayRange, parseYmdKey, DEFAULT_TIMEZONE } from '@/lib/reports/time';

export interface LeadFilterParams {
  q: string;
  status: string;
  source: string;
  completeness: string;
  /** Received on/after this local date (YYYY-MM-DD). */
  from: string;
  /** Received on/before this local date (YYYY-MM-DD), inclusive. */
  to: string;
  /** A staff profile id (who created the lead), or 'none' for public-form leads. */
  staff?: string;
  archived: boolean;
  /** Zone the from/to dates are local to — the org's reporting time zone. */
  timezone?: string;
}

// Strip characters that would break a PostgREST or() filter.
export function sanitizeSearch(q: string): string {
  return q.replace(/[,()*]/g, ' ').trim().slice(0, 80);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyLeadFilters<Q extends { [k: string]: any }>(
  query: Q,
  params: LeadFilterParams,
): Q {
  const tz = params.timezone ?? DEFAULT_TIMEZONE;
  const q = sanitizeSearch(params.q);
  if (q) {
    query = query.or(
      `full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`,
    );
  }
  if (params.status && isLeadStatus(params.status)) {
    query = query.eq('status', params.status);
  }
  if (params.source) query = query.eq('utm_source', params.source);
  if (params.completeness === 'incomplete') query = query.eq('is_complete', false);
  else if (params.completeness === 'complete') query = query.eq('is_complete', true);
  // Dates are whole local days in the org's zone, so a dashboard or report
  // link for "today" or "October" matches exactly the leads it counted.
  const from = parseYmdKey(params.from);
  if (from) query = query.gte('created_at', dayRange(tz, from).start.toISOString());
  const to = parseYmdKey(params.to);
  if (to) query = query.lt('created_at', dayRange(tz, to).end.toISOString());
  if (params.staff === 'none') query = query.is('created_by', null);
  else if (params.staff && UUID.test(params.staff)) query = query.eq('created_by', params.staff);
  if (params.archived) query = query.not('archived_at', 'is', null);
  else query = query.is('archived_at', null);
  return query;
}
