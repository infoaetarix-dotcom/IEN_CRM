import 'server-only';

import { redirect } from 'next/navigation';
import { requireUser, type SessionProfile } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { DEFAULT_TIMEZONE, dayRange, isValidTimeZone, zonedDateKey, zonedYMD } from '@/lib/reports/time';
import { isOfficeIp } from './ip';
import type { Place } from './records';

/**
 * Attendance (0052_attendance.sql). Agents clock in/out; the server decides
 * office or remote from the request IP and writes with the service role —
 * staff have no write access to these tables, so nobody can record a place
 * or time the server didn't see.
 */

/** No ping for this long = the CRM was closed: clock out at the last ping. */
export const STALE_SECONDS = 5 * 60;
/** How often an open CRM pings while clocked in. */
export const PING_MS = 2 * 60 * 1000;

export interface ClockState {
  open: { clockInAt: string; place: Place } | null;
  /** Today's finished sessions, in seconds (the timer adds the open one). */
  closedSecondsToday: number;
  /** Set when the latest session today was closed by the system. */
  autoClosedAt: string | null;
  /** End of today in the org's zone — after it, the day's total resets. */
  dayEndsAt: string;
  serverNow: string;
  timezone: string;
}

export async function isAttendanceEnabled(organizationId: string | null): Promise<boolean> {
  if (!organizationId) return false;
  const { data } = await (await createClient())
    .from('organization_modules')
    .select('enabled')
    .eq('organization_id', organizationId)
    .eq('module_key', 'attendance')
    .maybeSingle();
  return data?.enabled === true;
}

/** The /attendance page and export: org admins, module on. */
export async function requireAttendanceAdmin(): Promise<SessionProfile & { organization_id: string }> {
  const profile = await requireUser();
  if (profile.role !== 'admin' || !profile.organization_id) redirect('/dashboard');
  if (!(await isAttendanceEnabled(profile.organization_id))) redirect('/dashboard');
  return profile as SessionProfile & { organization_id: string };
}

/** Who clocks in: agents (not admins, not super admins) of an org with the module on. */
export async function canClockIn(profile: SessionProfile): Promise<boolean> {
  return (
    profile.role === 'agent' &&
    !profile.is_super_admin &&
    !!profile.organization_id &&
    (await isAttendanceEnabled(profile.organization_id))
  );
}

async function orgTimezone(svc: ReturnType<typeof createServiceClient>, orgId: string): Promise<string> {
  const { data } = await svc.from('reporting_settings').select('timezone').eq('organization_id', orgId).maybeSingle();
  const tz = data?.timezone;
  return tz && isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE;
}

export async function officeNetworks(orgId: string): Promise<string[]> {
  const { data } = await createServiceClient()
    .from('attendance_office_networks')
    .select('network')
    .eq('organization_id', orgId);
  return (data ?? []).map((n) => n.network);
}

async function placeFor(orgId: string, ip: string | null): Promise<Place> {
  return isOfficeIp(ip, await officeNetworks(orgId)) ? 'office' : 'remote';
}

/**
 * Auto clock-out sweep: closes sessions with no ping for STALE_SECONDS, or
 * whose day has ended, at their last ping. Cheap (a partial index on open
 * sessions), so it runs whenever attendance is read or written.
 */
export async function closeStaleSessions(onlyProfile?: string): Promise<void> {
  const { error } = await createServiceClient().rpc('attendance_close_stale', {
    stale_seconds: STALE_SECONDS,
    only_profile: onlyProfile ?? null,
  });
  if (error) console.error('[attendance] close stale failed', error.message);
}

async function stateFor(profile: SessionProfile & { organization_id: string }): Promise<ClockState> {
  const svc = createServiceClient();
  const tz = await orgTimezone(svc, profile.organization_id);
  const now = new Date();
  const todayKey = zonedDateKey(now, tz);
  const { data } = await svc
    .from('attendance_sessions')
    .select('clock_in_at, clock_in_place, clock_out_at, clock_out_method')
    .eq('profile_id', profile.id)
    .eq('work_date', todayKey)
    .order('clock_in_at', { ascending: true });
  const sessions = data ?? [];
  const open = sessions.find((s) => !s.clock_out_at) ?? null;
  const closed = sessions.filter((s) => s.clock_out_at);
  // The note is about how the day's last session ENDED.
  const latest = [...closed].sort((a, b) => a.clock_out_at!.localeCompare(b.clock_out_at!)).at(-1);
  return {
    open: open ? { clockInAt: open.clock_in_at, place: open.clock_in_place as Place } : null,
    closedSecondsToday: closed.reduce(
      (sum, s) => sum + Math.max(0, Math.floor((Date.parse(s.clock_out_at!) - Date.parse(s.clock_in_at)) / 1000)),
      0,
    ),
    autoClosedAt: !open && latest?.clock_out_method === 'auto' ? latest.clock_out_at : null,
    dayEndsAt: dayRange(tz, zonedYMD(now, tz)).end.toISOString(),
    serverNow: now.toISOString(),
    timezone: tz,
  };
}

type Agent = SessionProfile & { organization_id: string };

/** The top-bar state, after closing anything that went stale. */
export async function getClockState(profile: Agent): Promise<ClockState> {
  await closeStaleSessions(profile.id);
  return stateFor(profile);
}

export async function clockIn(profile: Agent, ip: string | null): Promise<ClockState> {
  await closeStaleSessions(profile.id);
  const svc = createServiceClient();
  const tz = await orgTimezone(svc, profile.organization_id);
  const place = await placeFor(profile.organization_id, ip);
  const now = new Date();
  // Times come from the database clock (column defaults), never the
  // agent's computer.
  const { error } = await svc.from('attendance_sessions').insert({
    organization_id: profile.organization_id,
    profile_id: profile.id,
    work_date: zonedDateKey(now, tz),
    day_ends_at: dayRange(tz, zonedYMD(now, tz)).end.toISOString(),
    clock_in_ip: ip,
    clock_in_place: place,
    last_seen_ip: ip,
    last_seen_place: place,
  });
  // 23505 = already clocked in (one open session per person) — a double
  // click or a second tab. Not an error: just show the running session.
  if (error && error.code !== '23505') throw new Error(error.message);
  return stateFor(profile);
}

export async function clockOut(profile: Agent, ip: string | null): Promise<ClockState> {
  await closeStaleSessions(profile.id);
  const svc = createServiceClient();
  const place = await placeFor(profile.organization_id, ip);
  const { data: open } = await svc
    .from('attendance_sessions')
    .select('id, clock_in_at')
    .eq('profile_id', profile.id)
    .is('clock_out_at', null)
    .maybeSingle();
  if (open) {
    const now = Math.max(Date.now(), Date.parse(open.clock_in_at));
    const { error } = await svc
      .from('attendance_sessions')
      .update({
        clock_out_at: new Date(now).toISOString(),
        clock_out_ip: ip,
        clock_out_place: place,
        clock_out_method: 'manual',
      })
      .eq('id', open.id)
      .is('clock_out_at', null);
    if (error) throw new Error(error.message);
  }
  return stateFor(profile);
}

/** "Still here" from an open CRM: keeps the session alive. */
export async function ping(profile: Agent, ip: string | null): Promise<ClockState> {
  // Sweep first: a laptop waking from a long sleep must not revive a
  // session that should already have ended when it went to sleep.
  await closeStaleSessions(profile.id);
  const place = await placeFor(profile.organization_id, ip);
  await createServiceClient()
    .from('attendance_sessions')
    .update({ last_seen_at: new Date().toISOString(), last_seen_ip: ip, last_seen_place: place })
    .eq('profile_id', profile.id)
    .is('clock_out_at', null);
  return stateFor(profile);
}
