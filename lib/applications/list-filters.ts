import { isApplicationStatus, type ApplicationStatus } from '@/lib/leads/display';
import { INTAKE_SEASON_VALUES } from '@/lib/form-options';

/**
 * /applications URL filters set by the intake report's click-throughs
 * (Settings → Reports), so each report number opens exactly the
 * applications it counted. Filtering is in memory, like the stage tabs —
 * the page already loads the org's full list at this scale.
 */

/** Stand-ins for "not set" in the university / country / season filters. */
export const NONE = '__none';

export interface ApplicationListFilters {
  season: string;
  year: number | null;
  statuses: ApplicationStatus[];
  university: string;
  country: string;
  /** Human description of the filter, from the report link (display only). */
  label: string;
}

type Params = Record<string, string | string[] | undefined>;

export function parseApplicationListFilters(sp: Params): ApplicationListFilters {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };
  const season = one('season');
  const year = Number(one('year'));
  return {
    season: season === NONE || (INTAKE_SEASON_VALUES as readonly string[]).includes(season) ? season : '',
    year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : null,
    statuses: one('statuses').split(',').filter(isApplicationStatus),
    university: one('university').slice(0, 200),
    country: one('country').slice(0, 80),
    label: one('label').slice(0, 120),
  };
}

export function hasApplicationListFilters(f: ApplicationListFilters): boolean {
  return !!(f.season || f.year || f.statuses.length || f.university || f.country);
}

export interface FilterableApplication {
  status: string;
  intake_season: string | null;
  intake_year: number | null;
  university_name: string | null;
  country: string | null;
}

export function matchesApplicationListFilters(a: FilterableApplication, f: ApplicationListFilters): boolean {
  if (f.season === NONE) {
    if (a.intake_season) return false;
  } else if (f.season && a.intake_season !== f.season) return false;
  if (f.year && a.intake_year !== f.year) return false;
  if (f.statuses.length && !(f.statuses as string[]).includes(a.status)) return false;
  if (f.university && (a.university_name ?? NONE) !== f.university) return false;
  if (f.country && (a.country ?? NONE) !== f.country) return false;
  return true;
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
