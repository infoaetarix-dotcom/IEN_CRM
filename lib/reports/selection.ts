import { INTAKE_SEASONS } from '@/lib/form-options';
import {
  monthRange,
  monthName,
  periodRange,
  periodReportDate,
  periodMonthsLabel,
  zonedYMD,
  type MonthPeriod,
  type Range,
} from './time';

/**
 * Which report Settings → Reports is showing, read from the URL with
 * sensible defaults. Shared by the page and the Excel export.
 *
 *   ?type=monthly&month=2026-10
 *   ?type=period&period=<id>&year=2026
 *   ?type=intake&season=fall&year=2026
 */

export type ReportType = 'monthly' | 'period' | 'intake';

export interface PeriodLike extends MonthPeriod {
  id: string;
  name: string;
}

export type ReportSelection =
  | { type: 'monthly'; year: number; month: number; range: Range; previous: Range; title: string; previousLabel: string }
  | {
      type: 'period';
      period: PeriodLike;
      year: number;
      range: Range;
      previous: Range;
      title: string;
      previousLabel: string;
      final: boolean;
      reportDate: Date;
    }
  | { type: 'period'; period: null; year: number; title: string }
  | { type: 'intake'; season: string; year: number; title: string; previousLabel: string };

type Params = Record<string, string | string[] | undefined>;

const SEASON_VALUES = INTAKE_SEASONS.map((s) => s.value as string);

export function seasonLabel(season: string): string {
  return INTAKE_SEASONS.find((s) => s.value === season)?.label ?? season;
}

export function resolveReportSelection(
  sp: Params,
  ctx: {
    tz: string;
    now: Date;
    periods: PeriodLike[];
    intakes: { season: string; year: number; count: number }[];
  },
): ReportSelection {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) ?? '';
  };
  const type: ReportType = (['monthly', 'period', 'intake'] as const).find((t) => t === one('type')) ?? 'monthly';
  const today = zonedYMD(ctx.now, ctx.tz);
  const yearParam = Number(one('year'));
  const validYear = Number.isInteger(yearParam) && yearParam >= 2000 && yearParam <= 2100 ? yearParam : null;

  if (type === 'intake') {
    const seasonParam = one('season');
    // Default: the intake with the most applications in the latest year that has any.
    const fallback = [...ctx.intakes].sort((a, b) => b.year - a.year || b.count - a.count)[0];
    const season = SEASON_VALUES.includes(seasonParam) ? seasonParam : (fallback?.season ?? 'fall');
    const year = validYear ?? fallback?.year ?? today.year;
    return {
      type,
      season,
      year,
      title: `${seasonLabel(season)} ${year} intake`,
      previousLabel: `${seasonLabel(season)} ${year - 1}`,
    };
  }

  if (type === 'period') {
    const chosen = ctx.periods.find((p) => p.id === one('period'));
    // Default: the most recently started period (this year's or last year's).
    let period = chosen ?? null;
    let year = validYear;
    if (!period) {
      let best: { p: PeriodLike; y: number; start: Date } | null = null;
      for (const y of [today.year, today.year - 1]) {
        for (const p of ctx.periods) {
          const start = periodRange(ctx.tz, p, y).start;
          if (start <= ctx.now && (!best || start > best.start)) best = { p, y, start };
        }
      }
      period = best?.p ?? ctx.periods[0] ?? null;
      year = year ?? best?.y ?? today.year;
    }
    year = year ?? today.year;
    if (!period) return { type, period: null, year, title: 'Reporting period' };
    return {
      type,
      period,
      year,
      range: periodRange(ctx.tz, period, year),
      previous: periodRange(ctx.tz, period, year - 1),
      title: `${period.name} ${year}`,
      previousLabel: `${periodMonthsLabel(period)} ${year - 1}`,
      final: ctx.now >= periodReportDate(ctx.tz, period, year),
      reportDate: periodReportDate(ctx.tz, period, year),
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

/** The URL for a given selection's parameters. */
export function reportHref(params: Record<string, string | number>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) q.set(k, String(v));
  return `/settings/reports?${q.toString()}`;
}
