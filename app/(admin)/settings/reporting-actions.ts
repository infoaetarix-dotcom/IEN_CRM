'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth/guards';
import { writeAuditLog } from '@/lib/audit';
import { isValidTimeZone, periodsOverlap, periodMonthsLabel } from '@/lib/reports/time';

/**
 * Settings → Reporting: the org's lead reporting periods and time zone
 * (0045_reporting.sql). Admin-only — reports are read by everyone, but the
 * setup that shapes them is an admin decision. RLS enforces the same.
 */

export interface ReportingActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const month = z.coerce.number().int().min(1, 'Choose a month').max(12, 'Choose a month');

const periodSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(60),
  start_month: month,
  end_month: month,
  report_month: month,
});

/**
 * The common study-abroad intakes, offered as a one-click starting point
 * when an org has no periods yet. Only a suggestion — every org edits or
 * replaces them, so nothing tenant-specific is fixed in the product.
 */
const COMMON_PERIODS = [
  { name: 'Jan–Feb intake', start_month: 1, end_month: 2, report_month: 3 },
  { name: 'Apr–May intake', start_month: 4, end_month: 5, report_month: 6 },
  { name: 'Sep–Oct intake', start_month: 9, end_month: 10, report_month: 11 },
];

function refresh() {
  revalidatePath('/settings');
  revalidatePath('/settings/reports');
  revalidatePath('/dashboard');
}

/** Create (no id) or update a reporting period. */
export async function saveReportingPeriod(
  periodId: string | null,
  _prev: ReportingActionState,
  formData: FormData,
): Promise<ReportingActionState> {
  const profile = await requireRole('admin');

  const parsed = periodSchema.safeParse({
    name: formData.get('name') ?? '',
    start_month: formData.get('start_month') ?? '',
    end_month: formData.get('end_month') ?? '',
    report_month: formData.get('report_month') ?? '',
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) {
      const key = String(i.path[0]);
      if (!fieldErrors[key]) fieldErrors[key] = i.message;
    }
    return { ok: false, error: 'Please correct the highlighted fields.', fieldErrors };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('reporting_periods')
    .select('id, name, start_month, end_month')
    .eq('organization_id', profile.organization_id);
  const clash = (existing ?? []).find((p) => p.id !== periodId && periodsOverlap(p, parsed.data));
  if (clash) {
    return {
      ok: false,
      error: `These months overlap “${clash.name}” (${periodMonthsLabel(clash)}). Each month can belong to one period only.`,
    };
  }

  const values = { ...parsed.data };
  const { data: saved, error } = periodId
    ? await supabase.from('reporting_periods').update(values).eq('id', periodId).select('id').single()
    : await supabase
        .from('reporting_periods')
        .insert({ ...values, organization_id: profile.organization_id, created_by: profile.id })
        .select('id')
        .single();
  if (error || !saved) return { ok: false, error: 'Could not save this period.' };

  await writeAuditLog({
    actorId: profile.id,
    organizationId: profile.organization_id,
    action: periodId ? 'reporting_period_updated' : 'reporting_period_created',
    entity: 'reporting',
    entityId: saved.id,
    metadata: values,
  });
  refresh();
  return { ok: true };
}

export async function deleteReportingPeriod(periodId: string): Promise<ReportingActionState> {
  const profile = await requireRole('admin');
  const { error } = await (await createClient()).from('reporting_periods').delete().eq('id', periodId);
  if (error) return { ok: false, error: 'Could not delete this period.' };

  await writeAuditLog({
    actorId: profile.id,
    organizationId: profile.organization_id,
    action: 'reporting_period_deleted',
    entity: 'reporting',
    entityId: periodId,
  });
  refresh();
  return { ok: true };
}

/** One-click starting point — only when the org has no periods yet. */
export async function addCommonReportingPeriods(): Promise<ReportingActionState> {
  const profile = await requireRole('admin');
  const supabase = await createClient();

  const { count } = await supabase
    .from('reporting_periods')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id);
  if (count) return { ok: false, error: 'You already have reporting periods set up.' };

  const { error } = await supabase.from('reporting_periods').insert(
    COMMON_PERIODS.map((p) => ({ ...p, organization_id: profile.organization_id, created_by: profile.id })),
  );
  if (error) return { ok: false, error: 'Could not add the periods.' };

  await writeAuditLog({
    actorId: profile.id,
    organizationId: profile.organization_id,
    action: 'reporting_period_created',
    entity: 'reporting',
    metadata: { preset: 'common', periods: COMMON_PERIODS.map((p) => p.name) },
  });
  refresh();
  return { ok: true };
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
  refresh();
  return { ok: true };
}
