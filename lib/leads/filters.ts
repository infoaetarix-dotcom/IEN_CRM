// Shared leads list-filter logic — used by the /leads page and the Excel
// export route so the two can never drift apart on what a given filter means.

import { isLeadStatus } from '@/lib/leads/display';

export interface LeadFilterParams {
  q: string;
  status: string;
  source: string;
  completeness: string;
  from: string;
  to: string;
  archived: boolean;
}

// Strip characters that would break a PostgREST or() filter.
export function sanitizeSearch(q: string): string {
  return q.replace(/[,()*]/g, ' ').trim().slice(0, 80);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyLeadFilters<Q extends { [k: string]: any }>(
  query: Q,
  params: LeadFilterParams,
): Q {
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
  if (params.from) query = query.gte('created_at', params.from);
  if (params.to) query = query.lte('created_at', `${params.to}T23:59:59`);
  if (params.archived) query = query.not('archived_at', 'is', null);
  else query = query.is('archived_at', null);
  return query;
}
