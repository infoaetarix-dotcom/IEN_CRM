import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { getReportingSettings } from '@/lib/reports/settings';
import { parseYmdKey, zonedDateKey } from '@/lib/reports/time';
import { buildDayRecords, type AgentRef, type AttendanceSession, type DayRecord } from './records';
import { closeStaleSessions } from './server';

const SESSION_LIMIT = 10000;

export interface AttendanceFilters {
  from: string;
  to: string;
  agent: string;
}

/** URL params → a valid range (default: this month so far). */
export function parseAttendanceFilters(sp: Record<string, string | undefined>, todayKey: string): AttendanceFilters {
  const valid = (v: string | undefined) => (v && parseYmdKey(v) ? v : '');
  let from = valid(sp.from) || `${todayKey.slice(0, 7)}-01`;
  let to = valid(sp.to) || todayKey;
  if (from > to) [from, to] = [to, from];
  return { from, to, agent: sp.agent ?? '' };
}

export interface AttendanceReport {
  timezone: string;
  todayKey: string;
  filters: AttendanceFilters;
  agents: AgentRef[];
  /** Today, every agent — the "who's in" board. */
  today: DayRecord[];
  history: DayRecord[];
}

/**
 * Everything /attendance and its export show, for an org admin. Reads run
 * under RLS (an admin sees their own org only); stale sessions are closed
 * first so nobody shows as "working" after leaving.
 */
export async function loadAttendanceReport(
  organizationId: string,
  sp: Record<string, string | undefined>,
): Promise<AttendanceReport> {
  await closeStaleSessions();
  const supabase = await createClient();
  const { timezone } = await getReportingSettings(organizationId);
  const now = new Date();
  const todayKey = zonedDateKey(now, timezone);
  const filters = parseAttendanceFilters(sp, todayKey);
  const earliest = filters.from < todayKey ? filters.from : todayKey;

  const [{ data: profiles }, { data: sessions }] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, is_active, created_at')
      .eq('organization_id', organizationId)
      .eq('role', 'agent'),
    supabase
      .from('attendance_sessions')
      .select('id, profile_id, work_date, clock_in_at, clock_in_place, clock_out_at, clock_out_place, clock_out_method')
      .eq('organization_id', organizationId)
      .gte('work_date', earliest)
      .lte('work_date', filters.to > todayKey ? filters.to : todayKey)
      .order('clock_in_at', { ascending: true })
      .limit(SESSION_LIMIT),
  ]);

  const agents: AgentRef[] = (profiles ?? []).map((p) => ({
    id: p.id,
    name: p.full_name,
    isActive: p.is_active,
    joinedDate: zonedDateKey(new Date(p.created_at), timezone),
  }));
  const all = (sessions ?? []) as AttendanceSession[];

  const today = buildDayRecords({
    sessions: all.filter((s) => s.work_date === todayKey),
    agents: agents.filter((a) => a.isActive),
    from: todayKey,
    to: todayKey,
    todayKey,
    now,
  });
  const pickedAgents = filters.agent ? agents.filter((a) => a.id === filters.agent) : agents;
  const history = buildDayRecords({
    sessions: all.filter((s) => s.work_date >= filters.from && s.work_date <= filters.to),
    agents: pickedAgents,
    from: filters.from,
    to: filters.to,
    todayKey,
    now,
  });

  return { timezone, todayKey, filters, agents, today, history };
}

export function formatTime(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: timezone });
}

export function formatDate(dateKey: string): string {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
