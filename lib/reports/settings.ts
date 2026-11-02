import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { DEFAULT_TIMEZONE, isValidTimeZone } from './time';

export interface ReportingSettings {
  timezone: string;
}

/**
 * The org's time zone (reporting_settings, 0045) — decides "today", "this
 * month", report boundaries and follow-up due dates. RLS-scoped to the
 * caller. No row, an invalid zone, or any read error falls back to the
 * default zone rather than breaking the page.
 */
export async function getReportingSettings(organizationId: string): Promise<ReportingSettings> {
  const { data } = await (await createClient())
    .from('reporting_settings')
    .select('timezone')
    .eq('organization_id', organizationId)
    .maybeSingle();
  const tz = data?.timezone;
  return { timezone: tz && isValidTimeZone(tz) ? tz : DEFAULT_TIMEZONE };
}
