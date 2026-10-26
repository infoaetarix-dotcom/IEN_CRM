/**
 * Calendar maths in a consultancy's own time zone. "Today", "this month" and
 * report periods must follow the office's clock, not the server's (Vercel
 * runs in UTC, so a lead at 2am in Karachi would otherwise land on the
 * previous day). Pure — no I/O — so it's unit-tested directly.
 */

/** Fallback when an org hasn't chosen a zone (see 0045_reporting.sql). */
export const DEFAULT_TIMEZONE = 'Asia/Karachi';

export interface YMD {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** The calendar date of `instant` as seen in `tz`. */
export function zonedYMD(instant: Date, tz: string): YMD {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** `instant`'s date in `tz` as YYYY-MM-DD — the key for daily buckets. */
export function zonedDateKey(instant: Date, tz: string): string {
  return ymdKey(zonedYMD(instant, tz));
}

export function ymdKey({ year, month, day }: YMD): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseYmdKey(key: string): YMD | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const ymd = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  if (ymd.month < 1 || ymd.month > 12 || ymd.day < 1 || ymd.day > 31) return null;
  return ymd;
}

/** Minutes `tz` is ahead of UTC at `instant` (e.g. +300 for Karachi). */
function offsetMinutes(instant: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/**
 * The instant local midnight starts on the given date in `tz`. Day/month
 * overflow is normalised (month 13 → January next year, day 32 → next
 * month), which keeps range arithmetic simple.
 */
export function startOfDayInZone(tz: string, year: number, month: number, day = 1): Date {
  const guess = Date.UTC(year, month - 1, day);
  let result = guess - offsetMinutes(new Date(guess), tz) * 60000;
  // Re-check at the candidate instant: the offset can differ across a DST change.
  const corrected = guess - offsetMinutes(new Date(result), tz) * 60000;
  if (corrected !== result) result = corrected;
  return new Date(result);
}

/** Half-open [start, end) instant range. */
export interface Range {
  start: Date;
  end: Date;
}

export function dayRange(tz: string, ymd: YMD): Range {
  return {
    start: startOfDayInZone(tz, ymd.year, ymd.month, ymd.day),
    end: startOfDayInZone(tz, ymd.year, ymd.month, ymd.day + 1),
  };
}

export function monthRange(tz: string, year: number, month: number): Range {
  return {
    start: startOfDayInZone(tz, year, month, 1),
    end: startOfDayInZone(tz, year, month + 1, 1),
  };
}

/** Every local date in [range.start, range.end), oldest first, as YYYY-MM-DD. */
export function dateKeysInRange(range: Range, tz: string): string[] {
  const keys: string[] = [];
  const first = zonedYMD(range.start, tz);
  for (let i = 0; ; i++) {
    const day = startOfDayInZone(tz, first.year, first.month, first.day + i);
    if (day >= range.end) break;
    keys.push(zonedDateKey(day, tz));
  }
  return keys;
}

export interface MonthPeriod {
  start_month: number;
  end_month: number;
  report_month: number;
}

/** Number of months a period spans, wrapping the year when start > end. */
export function periodLength(p: Pick<MonthPeriod, 'start_month' | 'end_month'>): number {
  return ((p.end_month - p.start_month + 12) % 12) + 1;
}

/**
 * The instant range of a period in a given year. `year` is the year the
 * period starts in, so a Nov–Jan period labelled 2026 runs Nov 2026–Jan 2027.
 */
export function periodRange(tz: string, p: MonthPeriod, year: number): Range {
  return {
    start: startOfDayInZone(tz, year, p.start_month, 1),
    end: startOfDayInZone(tz, year, p.start_month + periodLength(p), 1),
  };
}

/**
 * When the period's report becomes final: the first day of its report
 * month, on or after the period ends (so Sep–Oct reported in November is
 * final from 1 Nov; a report month earlier in the calendar than the end
 * month means the following year).
 */
export function periodReportDate(tz: string, p: MonthPeriod, year: number): Date {
  const end = periodRange(tz, p, year).end;
  const endYmd = zonedYMD(end, tz);
  const reportYear = p.report_month >= endYmd.month ? endYmd.year : endYmd.year + 1;
  return startOfDayInZone(tz, reportYear, p.report_month, 1);
}

/** The months (1–12) a period covers, in order. */
export function periodMonths(p: Pick<MonthPeriod, 'start_month' | 'end_month'>): number[] {
  return Array.from({ length: periodLength(p) }, (_, i) => ((p.start_month - 1 + i) % 12) + 1);
}

/** True when two periods share at least one month. */
export function periodsOverlap(
  a: Pick<MonthPeriod, 'start_month' | 'end_month'>,
  b: Pick<MonthPeriod, 'start_month' | 'end_month'>,
): boolean {
  const months = new Set(periodMonths(a));
  return periodMonths(b).some((m) => months.has(m));
}

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function monthName(month: number): string {
  return MONTH_NAMES[(month - 1 + 12) % 12]!;
}

/** "Jan–Feb" style label from a period's months. */
export function periodMonthsLabel(p: Pick<MonthPeriod, 'start_month' | 'end_month'>): string {
  const s = monthName(p.start_month).slice(0, 3);
  const e = monthName(p.end_month).slice(0, 3);
  return p.start_month === p.end_month ? s : `${s}–${e}`;
}
