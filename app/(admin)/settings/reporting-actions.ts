'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { writeAuditLog } from '@/lib/audit';
import { isValidTimeZone } from '@/lib/reports/time';

/**
 * Settings → Time zone (reporting_settings, 0045). Admin-only; RLS enforces
 * the same. Everyone's "today" — dashboard, reports, follow-ups — follows it.
 * (Hand-set reporting periods were removed: reports now follow each lead's
 * and application's intake field.)
 */

export interface ReportingActionState {
  ok: boolean;
  error?: string;
}

export async function saveReportingTimezone(timezone: string): Promise<ReportingActionState> {
  const profile = await requireRole('admin');
  const tz = timezone.trim();
  if (!isValidTimeZone(tz)) return { ok: false, error: 'Choose a valid time zone.' };

  const { error } = await (await createClient())
    .from('reporting_settings')
    .upsert({ organization_id: profile.organization_id, timezone: tz });
  if (error) return { ok: false, error: 'Could not save the time zone.' };

  await writeAuditLog({
    actorId: profile.id,
    organizationId: profile.organization_id,
    action: 'reporting_settings_updated',
    entity: 'reporting',
    metadata: { timezone: tz },
  });
  revalidatePath('/settings');
  revalidatePath('/settings/reports');
  revalidatePath('/dashboard');
  return { ok: true };
}
