import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { DEFAULT_TIMEZONE, isValidTimeZone } from './time';

export interface ReportingPeriod {
  id: string;
  name: string;
  start_month: number;
  end_month: number;
  report_month: number;
}

export interface ReportingSettings {
  timezone: string;
  periods: ReportingPeriod[];
}

/**
 * The org's reporting setup (0045_reporting.sql), RLS-scoped to the caller.
 * Any read error — including the tables not existing yet because the
 * migration hasn't been run — falls back to defaults rather than breaking
 * the dashboard: no periods, and the default time zone.
 */
export async function getReportingSettings(organizationId: string): Promise<ReportingSettings> {
  const supabase = await createClient();
  const [settingsRes, periodsRes] = await Promise.all([
    supabase
      .from('reporting_settings')
      .select('timezone')
      .eq('organization_id', organizationId)
      .maybeSingle(),
    supabase
      .from('reporting_periods')
      .select('id, name, start_month, end_month, report_month')
      .eq('organization_id', organizationId)
      .order('start_month'),
  ]);

  const tz = settingsRes.data?.timezone;
  return {
    timezone: tz && isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE,
    periods: periodsRes.error ? [] : (periodsRes.data ?? []),
  };
}
