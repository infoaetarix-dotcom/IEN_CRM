import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { followUpFilterRange, type FollowUpFilter } from './status';

/** An open follow-up as the tables and buttons need it. */
export interface OpenFollowUp {
  id: string;
  due_date: string;
  note: string | null;
}

export interface FollowUpHistoryItem extends OpenFollowUp {
  created_by: string | null;
  created_at: string;
  completed_at: string | null;
  completed_by: string | null;
}

type Kind = 'lead' | 'application';
const column = (kind: Kind) => (kind === 'lead' ? 'lead_id' : 'application_id');

/**
 * Open follow-ups for every lead or application in the caller's org (RLS),
 * keyed by record id — one query for a whole table page.
 */
export async function getOpenFollowUps(kind: Kind): Promise<Map<string, OpenFollowUp>> {
  const col = column(kind);
  const { data } = await (await createClient())
    .from('follow_ups')
    .select(`id, due_date, note, ${col}`)
    .is('completed_at', null)
    .not(col, 'is', null);
  const map = new Map<string, OpenFollowUp>();
  for (const f of (data ?? []) as unknown as (OpenFollowUp & Record<string, string>)[]) {
    map.set(f[col]!, { id: f.id, due_date: f.due_date, note: f.note });
  }
  return map;
}

/** Ids of the leads / applications whose open follow-up matches a filter. */
export async function followUpRecordIds(kind: Kind, filter: FollowUpFilter, todayKey: string): Promise<string[]> {
  const col = column(kind);
  const { from, to } = followUpFilterRange(filter, todayKey);
  let query = (await createClient())
    .from('follow_ups')
    .select(col)
    .is('completed_at', null)
    .not(col, 'is', null);
  if (from) query = query.gte('due_date', from);
  if (to) query = query.lte('due_date', to);
  const { data } = await query;
  return ((data ?? []) as unknown as Record<string, string>[]).map((r) => r[col]!);
}

/** One record's open follow-up plus its done history, newest first. */
export async function getFollowUpsFor(
  kind: Kind,
  id: string,
): Promise<{ open: OpenFollowUp | null; history: FollowUpHistoryItem[] }> {
  const { data } = await (await createClient())
    .from('follow_ups')
    .select('id, due_date, note, created_by, created_at, completed_at, completed_by')
    .eq(column(kind), id)
    .order('created_at', { ascending: false });
  const rows = (data ?? []) as FollowUpHistoryItem[];
  const open = rows.find((r) => !r.completed_at) ?? null;
  return {
    open: open ? { id: open.id, due_date: open.due_date, note: open.note } : null,
    history: rows.filter((r) => r.completed_at),
  };
}

/** Counts for the dashboard strip: due today and overdue, split by kind. */
export async function countDueFollowUps(todayKey: string) {
  const { data } = await (await createClient())
    .from('follow_ups')
    .select('due_date, lead_id, application_id, leads(archived_at)')
    .is('completed_at', null)
    .lte('due_date', todayKey);
  const counts = { today: { leads: 0, applications: 0 }, overdue: { leads: 0, applications: 0 } };
  for (const f of data ?? []) {
    const lead = Array.isArray(f.leads) ? f.leads[0] : f.leads;
    if (f.lead_id && lead?.archived_at) continue; // archived leads aren't worked
    const bucket = f.due_date === todayKey ? counts.today : counts.overdue;
    if (f.lead_id) bucket.leads++;
    else bucket.applications++;
  }
  return counts;
}
