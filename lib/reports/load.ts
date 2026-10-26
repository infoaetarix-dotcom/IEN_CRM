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

export interface IntakeOption {
  season: string;
  year: number;
  count: number;
}

/** Every intake that has applications, plus how many have none set. */
export async function loadIntakeOptions(): Promise<{ options: IntakeOption[]; withoutIntake: number }> {
  const data =
    must(await (await createClient()).from('applications').select('intake_season, intake_year'), 'intakes') ?? [];
  const counts = new Map<string, IntakeOption>();
  let withoutIntake = 0;
  for (const a of data) {
    if (!a.intake_season || !a.intake_year) {
      withoutIntake++;
      continue;
    }
    const key = `${a.intake_season}:${a.intake_year}`;
    const o = counts.get(key) ?? { season: a.intake_season, year: a.intake_year, count: 0 };
    o.count++;
    counts.set(key, o);
  }
  return { options: [...counts.values()], withoutIntake };
}
