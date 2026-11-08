/**
 * Turning attendance sessions (0052_attendance.sql) into what admins read:
 * one record per agent per day, with every session, the day's total, and
 * Absent for a weekday with no clock-in. Saturday and Sunday are off days.
 * Pure — no I/O — so it's unit-tested directly.
 */

export type Place = 'office' | 'remote';

export interface AttendanceSession {
  id: string;
  profile_id: string;
  work_date: string;
  clock_in_at: string;
  clock_in_place: Place;
  clock_out_at: string | null;
  clock_out_place: Place | null;
  clock_out_method: 'manual' | 'auto' | null;
}

export interface AgentRef {
  id: string;
  name: string;
  /** Agents only count as absent while active, and from the day they joined. */
  isActive: boolean;
  joinedDate: string;
}

export type DayStatus = 'working' | 'present' | 'absent' | 'not_in_yet';

export interface DayRecord {
  date: string;
  agentId: string;
  agentName: string;
  status: DayStatus;
  weekend: boolean;
  sessions: AttendanceSession[];
  totalSeconds: number;
}

/** Saturday or Sunday (the date is a plain calendar day, so read it as UTC). */
export function isWeekend(dateKey: string): boolean {
  const day = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

/** Length of a session; an open one runs until `now`. */
export function sessionSeconds(s: Pick<AttendanceSession, 'clock_in_at' | 'clock_out_at'>, now: Date): number {
  const end = s.clock_out_at ? Date.parse(s.clock_out_at) : now.getTime();
  return Math.max(0, Math.floor((end - Date.parse(s.clock_in_at)) / 1000));
}

export function totalSeconds(sessions: AttendanceSession[], now: Date): number {
  return sessions.reduce((sum, s) => sum + sessionSeconds(s, now), 0);
}

/** "5h 25m", "45m", "0m". */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  if (!h) return `${m}m`;
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
}

/** "01:24:10" — the running clock in the top bar. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Every calendar date from `from` to `to` inclusive, newest first. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${from}T00:00:00Z`);
  for (let t = Date.parse(`${to}T00:00:00Z`); t >= end; t -= 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
    if (out.length >= 4000) break; // ~11 years: a sane cap on any one report
  }
  return out;
}

/**
 * One record per agent per day in [from, to], newest day first, agents by
 * name. Days after today are skipped. A weekday with no session is Absent
 * (or "Not in yet" today) for active agents who had joined by then; a
 * weekend day only appears if someone worked it.
 */
export function buildDayRecords({
  sessions,
  agents,
  from,
  to,
  todayKey,
  now,
}: {
  sessions: AttendanceSession[];
  agents: AgentRef[];
  from: string;
  to: string;
  todayKey: string;
  now: Date;
}): DayRecord[] {
  const byKey = new Map<string, AttendanceSession[]>();
  for (const s of sessions) {
    const key = `${s.work_date}|${s.profile_id}`;
    const list = byKey.get(key) ?? [];
    list.push(s);
    byKey.set(key, list);
  }
  for (const list of byKey.values()) list.sort((a, b) => a.clock_in_at.localeCompare(b.clock_in_at));

  const sortedAgents = [...agents].sort((a, b) => a.name.localeCompare(b.name));
  const records: DayRecord[] = [];
  for (const date of datesBetween(from, to > todayKey ? todayKey : to)) {
    const weekend = isWeekend(date);
    for (const agent of sortedAgents) {
      const list = byKey.get(`${date}|${agent.id}`) ?? [];
      if (list.length) {
        records.push({
          date,
          agentId: agent.id,
          agentName: agent.name,
          status: list.some((s) => !s.clock_out_at) ? 'working' : 'present',
          weekend,
          sessions: list,
          totalSeconds: totalSeconds(list, now),
        });
      } else if (!weekend && agent.isActive && date >= agent.joinedDate) {
        records.push({
          date,
          agentId: agent.id,
          agentName: agent.name,
          status: date === todayKey ? 'not_in_yet' : 'absent',
          weekend,
          sessions: [],
          totalSeconds: 0,
        });
      }
    }
  }
  return records;
}
