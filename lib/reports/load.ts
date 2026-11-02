import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { buildLeadReport, type LeadReport } from './leads';
import { buildIntakeReport, type IntakeReport } from './applications';
import { dateKeysInRange, type Range } from './time';

/**
 * Data loading for the reports under Settings → Reports — shared by the
 * report page and its Excel export so the two can never disagree. All reads
 * use the caller's RLS-scoped client: everyone in the org sees the same
 * org-wide numbers, and nothing crosses tenants.
 *
 * Archived leads are left out, matching the dashboard and the leads list a
 * report number opens.
 */

/**
 * A failed read throws rather than coming back empty: a report quietly
 * showing 0 leads is worse than an error page, because nobody questions it.
 */
function must<T>(res: { data: T | null; error: { message: string } | null }, what: string): T {
  if (res.error) throw new Error(`Report: could not load ${what} (${res.error.message})`);
  return res.data as T;
}

export async function loadLeadReport(range: Range, tz: string): Promise<LeadReport> {
  const supabase = await createClient();
  const start = range.start.toISOString();
  const end = range.end.toISOString();

  const [leadsRes, historyRes, appsRes, profilesRes] = await Promise.all([
    supabase
      .from('leads')
      .select('id, status, utm_source, created_by, created_at')
      .is('archived_at', null)
      .gte('created_at', start)
      .lt('created_at', end),
    // A lead's first status change can't predate the lead, so only changes
    // since the range began can be a first contact for these leads.
    supabase
      .from('lead_status_history')
      .select('lead_id, changed_at')
      .gte('changed_at', start)
      .order('changed_at', { ascending: true }),
    supabase.from('applications').select('lead_id'),
    supabase.from('profiles').select('id, full_name'),
  ]);
  const leads = must(leadsRes, 'leads') ?? [];
  const history = must(historyRes, 'status history') ?? [];
  const apps = must(appsRes, 'applications') ?? [];
  const profiles = must(profilesRes, 'staff') ?? [];

  const firstContact = new Map<string, string>();
  for (const h of history) {
    if (!firstContact.has(h.lead_id)) firstContact.set(h.lead_id, h.changed_at);
  }

  return buildLeadReport(leads, {
    tz,
    range,
    dayKeys: dateKeysInRange(range, tz),
    firstContact,
    convertedIds: new Set(apps.map((a) => a.lead_id)),
    nameById: new Map(profiles.map((p) => [p.id, p.full_name])),
  });
}

/** Leads received in a range — for "vs previous month / last year". */
export async function countLeads(range: Range): Promise<number> {
  const res = await (await createClient())
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .gte('created_at', range.start.toISOString())
    .lt('created_at', range.end.toISOString());
  if (res.error) throw new Error(`Report: could not count leads (${res.error.message})`);
  return res.count ?? 0;
}

export async function loadIntakeReport(season: string, year: number): Promise<IntakeReport> {
  const res = await (await createClient())
    .from('applications')
    .select('status, universities(name, country)')
    .eq('intake_season', season)
    .eq('intake_year', year);
  const data = must(res, 'applications') ?? [];

  return buildIntakeReport(
    data.map((a) => {
      const uni = Array.isArray(a.universities) ? a.universities[0] : a.universities;
      return { status: a.status, university_name: uni?.name ?? null, country: uni?.country ?? null };
    }),
  );
}

/**
 * Leads whose intended intake is this one — the leads half of the intake
 * report. Same breakdowns as the monthly report (source, status, staff,
 * conversion, response); there's no per-day chart, since these leads
 * arrived over many months.
 */
export async function loadIntakeLeadReport(season: string, year: number, tz: string): Promise<LeadReport> {
  const supabase = await createClient();
  const [leadsRes, historyRes, appsRes, profilesRes] = await Promise.all([
    supabase
      .from('leads')
      .select('id, status, utm_source, created_by, created_at')
      .is('archived_at', null)
      .eq('intake_season', season)
      .eq('intake_year', year),
    supabase.from('lead_status_history').select('lead_id, changed_at').order('changed_at', { ascending: true }),
    supabase.from('applications').select('lead_id'),
    supabase.from('profiles').select('id, full_name'),
  ]);
  const leads = must(leadsRes, 'leads') ?? [];
  const history = must(historyRes, 'status history') ?? [];
  const firstContact = new Map<string, string>();
  for (const h of history) {
    if (!firstContact.has(h.lead_id)) firstContact.set(h.lead_id, h.changed_at);
  }
  return buildLeadReport(leads, {
    tz,
    range: { start: new Date(0), end: new Date() },
    dayKeys: [],
    firstContact,
    convertedIds: new Set((must(appsRes, 'applications') ?? []).map((a) => a.lead_id)),
    nameById: new Map((must(profilesRes, 'staff') ?? []).map((p) => [p.id, p.full_name])),
  });
}

/** Leads for an intake — for "vs same intake last year". */
export async function countIntakeLeads(season: string, year: number): Promise<number> {
  const res = await (await createClient())
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .is('archived_at', null)
    .eq('intake_season', season)
    .eq('intake_year', year);
  if (res.error) throw new Error(`Report: could not count leads (${res.error.message})`);
  return res.count ?? 0;
}

export interface IntakeOption {
  season: string;
  year: number;
  count: number;
}

/**
 * Every intake that has leads or applications (for the default choice),
 * plus how many active leads and applications have no intake set.
 */
export async function loadIntakeOptions(): Promise<{
  options: IntakeOption[];
  withoutIntake: { leads: number; applications: number };
}> {
  const supabase = await createClient();
  const [appsRes, leadsRes] = await Promise.all([
    supabase.from('applications').select('intake_season, intake_year'),
    supabase.from('leads').select('intake_season, intake_year').is('archived_at', null),
  ]);
  const counts = new Map<string, IntakeOption>();
  const withoutIntake = { leads: 0, applications: 0 };
  const tally = (rows: { intake_season: string | null; intake_year: number | null }[], kind: 'leads' | 'applications') => {
    for (const r of rows) {
      if (!r.intake_season || !r.intake_year) {
        withoutIntake[kind]++;
        continue;
      }
      const key = `${r.intake_season}:${r.intake_year}`;
      const o = counts.get(key) ?? { season: r.intake_season, year: r.intake_year, count: 0 };
      o.count++;
      counts.set(key, o);
    }
  };
  tally(must(appsRes, 'intakes') ?? [], 'applications');
  tally(must(leadsRes, 'lead intakes') ?? [], 'leads');
  return { options: [...counts.values()], withoutIntake };
}
