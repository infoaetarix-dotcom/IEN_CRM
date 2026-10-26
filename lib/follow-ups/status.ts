/**
 * Follow-up dates are calendar dates (no time of day), compared against
 * "today" in the org's reporting time zone. Pure — unit-tested directly.
 */

export type FollowUpKind = 'overdue' | 'today' | 'upcoming';

export interface FollowUpState {
  kind: FollowUpKind;
  /** Days past due (overdue only). */
  daysOverdue: number;
  /** Short label for the table tag, e.g. "Overdue · 2 days". */
  label: string;
}

function dayNumber(key: string): number {
  return Math.round(Date.parse(`${key}T00:00:00Z`) / 86_400_000);
}

/** Days from `fromKey` to `toKey` (YYYY-MM-DD), negative if earlier. */
export function daysBetween(fromKey: string, toKey: string): number {
  return dayNumber(toKey) - dayNumber(fromKey);
}

/** YYYY-MM-DD `days` after `key`. */
export function addDays(key: string, days: number): string {
  return new Date(Date.parse(`${key}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

export function formatDueDate(key: string): string {
  return new Date(`${key}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

export function followUpState(dueDate: string, todayKey: string): FollowUpState {
  const diff = daysBetween(todayKey, dueDate);
  if (diff === 0) return { kind: 'today', daysOverdue: 0, label: 'Follow-up today' };
  if (diff < 0) {
    const days = -diff;
    return { kind: 'overdue', daysOverdue: days, label: `Overdue · ${days} day${days === 1 ? '' : 's'}` };
  }
  return { kind: 'upcoming', daysOverdue: 0, label: `Follow-up ${formatDueDate(dueDate)}` };
}

/** The /leads and /applications `followup` filter values. */
export const FOLLOW_UP_FILTERS = ['today', 'overdue', 'week', 'any'] as const;
export type FollowUpFilter = (typeof FOLLOW_UP_FILTERS)[number];

export function isFollowUpFilter(v: string): v is FollowUpFilter {
  return (FOLLOW_UP_FILTERS as readonly string[]).includes(v);
}

export const FOLLOW_UP_FILTER_LABELS: Record<FollowUpFilter, string> = {
  today: 'Follow-up today',
  overdue: 'Follow-up overdue',
  week: 'Follow-up in next 7 days',
  any: 'Any open follow-up',
};

/** Inclusive due-date bounds for a filter (null = unbounded). */
export function followUpFilterRange(filter: FollowUpFilter, todayKey: string): { from: string | null; to: string | null } {
  switch (filter) {
    case 'today':
      return { from: todayKey, to: todayKey };
    case 'overdue':
      return { from: null, to: addDays(todayKey, -1) };
    case 'week':
      return { from: todayKey, to: addDays(todayKey, 7) }; // so "In 1 week" (today + 7) is included
    case 'any':
      return { from: null, to: null };
  }
}

export function matchesFollowUpFilter(dueDate: string, filter: FollowUpFilter, todayKey: string): boolean {
  const { from, to } = followUpFilterRange(filter, todayKey);
  return (!from || dueDate >= from) && (!to || dueDate <= to);
}
