import { isApplicationStatus, type ApplicationStatus } from '@/lib/leads/display';
import { INTAKE_SEASON_VALUES } from '@/lib/form-options';

/**
 * /applications URL filters — set by the filter bar (search, status,
 * university, country, intake, created by, created dates) and by the intake
 * report's click-throughs (Settings → Reports), which use the same keys so a
 * report number simply opens the list with the bar pre-filled. Filtering is
 * in memory, like the stage tabs — the page already loads the org's full
 * list at this scale.
 */

/** Stand-ins for "not set" in the university / country / intake filters. */
export const NONE = '__none';

export interface ApplicationListFilters {
  q: string;
  season: string;
  year: number | null;
  /** One status from the bar, or several (a report milestone like "Visa applied"). */
  statuses: ApplicationStatus[];
  university: string;
  country: string;
  /** Created-by staff profile id. */
  staff: string;
  /** Created on/after / on/before, YYYY-MM-DD in the org's time zone. */
  from: string;
  to: string;
  /** Human description of a report click-through (display only). */
  label: string;
}

type Params = Record<string, string | string[] | undefined>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseApplicationListFilters(sp: Params): ApplicationListFilters {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };
  const season = one('season');
  const year = Number(one('year'));
  return {
    q: one('q').trim().slice(0, 80),
    season: season === NONE || (INTAKE_SEASON_VALUES as readonly string[]).includes(season) ? season : '',
    year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null,
    statuses: one('statuses').split(',').filter(isApplicationStatus),
    university: one('university').slice(0, 200),
    country: one('country').slice(0, 80),
    staff: one('staff').slice(0, 64),
    from: DATE.test(one('from')) ? one('from') : '',
    to: DATE.test(one('to')) ? one('to') : '',
    label: one('label').slice(0, 120),
  };
}

/** Any narrowing filter set (the label alone doesn't count). */
export function hasApplicationListFilters(f: ApplicationListFilters): boolean {
  return !!(
    f.q ||
    f.season ||
    f.year ||
    f.statuses.length ||
    f.university ||
    f.country ||
    f.staff ||
    f.from ||
    f.to
  );
}

export interface FilterableApplication {
  status: string;
  intake_season: string | null;
  intake_year: number | null;
  university_name: string | null;
  country: string | null;
  created_by: string | null;
  /** Created date in the org's time zone, YYYY-MM-DD. */
  created_date: string;
  /** Lower-cased text the search box matches: names, contact, numbers, passport. */
  search_text: string;
}

export function matchesApplicationListFilters(a: FilterableApplication, f: ApplicationListFilters): boolean {
  if (f.q) {
    const terms = f.q.toLowerCase().replace(/^#/, '').split(/\s+/).filter(Boolean);
    if (!terms.every((t) => a.search_text.includes(t))) return false;
  }
  if (f.season === NONE) {
    if (a.intake_season) return false;
  } else if (f.season && a.intake_season !== f.season) return false;
  if (f.year && a.intake_year !== f.year) return false;
  if (f.statuses.length && !(f.statuses as string[]).includes(a.status)) return false;
  if (f.university && (a.university_name ?? NONE) !== f.university) return false;
  if (f.country && (a.country ?? NONE) !== f.country) return false;
  if (f.staff && a.created_by !== f.staff) return false;
  if (f.from && a.created_date < f.from) return false;
  if (f.to && a.created_date > f.to) return false;
  return true;
}

/** Search text for an application row — kept beside the matcher it feeds. */
export function applicationSearchText(parts: (string | number | null | undefined)[]): string {
  return parts
    .filter((p) => p != null && p !== '')
    .map((p) => String(p).toLowerCase())
    .join(' ');
}

/** Query string for an /applications link from a report. */
export function applicationsHref(params: {
  season?: string;
  year?: number;
  statuses?: readonly string[];
  university?: string | null;
  country?: string | null;
  label?: string;
}): string {
  const q = new URLSearchParams();
  if (params.season) q.set('season', params.season);
  if (params.year) q.set('year', String(params.year));
  if (params.statuses?.length) q.set('statuses', params.statuses.join(','));
  if (params.university !== undefined) q.set('university', params.university ?? NONE);
  if (params.country !== undefined) q.set('country', params.country ?? NONE);
  if (params.label) q.set('label', params.label);
  return `/applications?${q.toString()}`;
}
