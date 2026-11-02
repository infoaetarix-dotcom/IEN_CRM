import { INTAKE_SEASONS } from '@/lib/form-options';
import { monthRange, monthName, startOfDayInZone, zonedYMD, type Range } from './time';

/**
 * Which report Settings → Reports is showing, read from the URL with
 * sensible defaults. Shared by the page and the Excel export.
 *
 *   ?type=monthly&month=2026-10        leads received in a month
 *   ?type=intake&season=sep_oct&year=2026   leads + applications for an intake
 *
 * Intakes come straight from each lead's / application's intake field, so
 * there is nothing to set up: Jan–Feb is reported (final) in March,
 * Apr–May in June, Sep–Oct in November (INTAKE_SEASONS.reportMonth).
 */

export type ReportType = 'monthly' | 'intake';

export type ReportSelection =
  | { type: 'monthly'; year: number; month: number; range: Range; previous: Range; title: string; previousLabel: string }
  | {
      type: 'intake';
      season: string;
      year: number;
      title: string;
      previousLabel: string;
      /** First day of the intake's report month — the report is final from then. */
      reportDate: Date;
      final: boolean;
    };

type Params = Record<string, string | string[] | undefined>;

const SEASON_VALUES = INTAKE_SEASONS.map((s) => s.value as string);

export function seasonLabel(season: string): string {
  return INTAKE_SEASONS.find((s) => s.value === season)?.label ?? season;
}

/** When an intake's report becomes final: the 1st of its report month that year. */
export function intakeReportDate(tz: string, season: string, year: number): Date {
  const intake = INTAKE_SEASONS.find((s) => s.value === season);
  return startOfDayInZone(tz, year, intake?.reportMonth ?? 12, 1);
}

export function resolveReportSelection(
  sp: Params,
  ctx: {
    tz: string;
    now: Date;
    /** Intakes that have data, for the default choice. */
    intakes: { season: string; year: number; count: number }[];
  },
): ReportSelection {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };
  const type: ReportType = one('type') === 'intake' ? 'intake' : 'monthly';
  const today = zonedYMD(ctx.now, ctx.tz);
  const yearParam = Number(one('year'));
  const validYear = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100 ? yearParam : null;

  if (type === 'intake') {
    const seasonParam = one('season');
    // Default: the intake with the most records in the latest year that has any.
    const fallback = [...ctx.intakes].sort((a, b) => b.year - a.year || b.count - a.count)[0];
    const season = SEASON_VALUES.includes(seasonParam) ? seasonParam : (fallback?.season ?? 'sep_oct');
    const year = validYear ?? fallback?.year ?? today.year;
    const reportDate = intakeReportDate(ctx.tz, season, year);
    return {
      type,
      season,
      year,
      title: `${seasonLabel(season)} ${year} intake`,
      previousLabel: `${seasonLabel(season)} ${year - 1}`,
      reportDate,
      final: ctx.now >= reportDate,
    };
  }

  // Monthly — default to last month, the one a monthly report is usually for.
  const m = /^(\d{4})-(\d{2})$/.exec(one('month'));
  let year = today.month === 1 ? today.year - 1 : today.year;
  let month = today.month === 1 ? 12 : today.month - 1;
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) {
    year = Number(m[1]);
    month = Number(m[2]);
  }
  const prevYear = month === 1 ? year - 1 : year;
  const prevMonth = month === 1 ? 12 : month - 1;
  return {
    type: 'monthly',
    year,
    month,
    range: monthRange(ctx.tz, year, month),
    previous: monthRange(ctx.tz, prevYear, prevMonth),
    title: `${monthName(month)} ${year}`,
    previousLabel: `${monthName(prevMonth)} ${prevYear}`,
  };
}
