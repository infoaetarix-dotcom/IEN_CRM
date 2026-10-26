'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/guards';
import { writeAuditLog } from '@/lib/audit';
import { getReportingSettings } from '@/lib/reports/settings';
import { zonedDateKey } from '@/lib/reports/time';

/**
 * Follow-ups on leads and applications (0046_follow_ups.sql). Shared like
 * the records they belong to: any active staff member in the org can set,
 * complete or remove one. A follow-up only closes when someone clicks
 * "Mark done" — nothing here or elsewhere completes it automatically.
 */

export interface FollowUpActionResult {
  ok: boolean;
  error?: string;
}

export type FollowUpTarget = { kind: 'lead' | 'application'; id: string };

const targetSchema = z.object({
  kind: z.enum(['lead', 'application']),
  id: z.string().uuid(),
});

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date');
const noteSchema = z
  .string()
  .trim()
  .max(500, 'Keep the note under 500 characters')
  .optional()
  .transform((v) => (v ? v : null));

function refresh(target: FollowUpTarget) {
  revalidatePath(target.kind === 'lead' ? '/leads' : '/applications');
  revalidatePath(`/${target.kind === 'lead' ? 'leads' : 'applications'}/${target.id}`);
  revalidatePath('/dashboard');
}

/** Today's date in the org's time zone — follow-ups can't be set in the past. */
async function todayFor(organizationId: string) {
  const { timezone } = await getReportingSettings(organizationId);
  return zonedDateKey(new Date(), timezone);
}

/**
 * Set (or move) the follow-up on a lead or application. Updates the open
 * follow-up if there is one, otherwise starts a new one.
 */
export async function setFollowUp(
  target: FollowUpTarget,
  input: { dueDate: string; note?: string },
): Promise<FollowUpActionResult> {
  const profile = await requireUser();
  const t = targetSchema.safeParse(target);
  const due = dateSchema.safeParse(input.dueDate);
  const note = noteSchema.safeParse(input.note ?? '');
  if (!t.success) return { ok: false, error: 'Invalid record.' };
  if (!due.success) return { ok: false, error: 'Choose a follow-up date.' };
  if (!note.success) return { ok: false, error: note.error.issues[0]!.message };
  if (due.data < (await todayFor(profile.organization_id!))) {
    return { ok: false, error: 'Choose today or a later date.' };
  }

  const supabase = await createClient();
  const column = t.data.kind === 'lead' ? 'lead_id' : 'application_id';

  // The record must be visible to the caller (RLS) — this also stops a
  // follow-up being pinned to another org's lead or application.
  const { data: record } = await supabase
    .from(t.data.kind === 'lead' ? 'leads' : 'applications')
    .select('id')
    .eq('id', t.data.id)
    .maybeSingle();
  if (!record) return { ok: false, error: 'Record not found.' };

  const { data: open } = await supabase
    .from('follow_ups')
    .select('id')
    .eq(column, t.data.id)
    .is('completed_at', null)
    .maybeSingle();

  const { data: saved, error } = open
    ? await supabase
        .from('follow_ups')
        .update({ due_date: due.data, note: note.data })
        .eq('id', open.id)
        .select('id')
        .single()
    : await supabase
        .from('follow_ups')
        .insert({
          organization_id: profile.organization_id,
          [column]: t.data.id,
          due_date: due.data,
          note: note.data,
          created_by: profile.id,
        })
        .select('id')
        .single();
  if (error || !saved) return { ok: false, error: 'Could not save the follow-up.' };

  await writeAuditLog({
    actorId: profile.id,
    organizationId: profile.organization_id,
    action: 'follow_up_set',
    entity: 'follow_up',
    entityId: saved.id,
    metadata: { [column]: t.data.id, due_date: due.data, moved: !!open },
  });
  refresh(t.data);
  return { ok: true };
}

/**
 * Mark the open follow-up done — the only way one closes. Optionally
 * schedules the next one in the same step.
 */
export async function completeFollowUp(
  followUpId: string,
  next?: { dueDate: string; note?: string },
): Promise<FollowUpActionResult> {
  const profile = await requireUser();
  if (!z.string().uuid().safeParse(followUpId).success) return { ok: false, error: 'Invalid follow-up.' };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from('follow_ups')
    .select('id, lead_id, application_id, completed_at')
    .eq('id', followUpId)
    .maybeSingle();
  if (!current) return { ok: false, error: 'Follow-up not found.' };
  if (current.completed_at) return { ok: false, error: 'This follow-up is already done.' };

  const target: FollowUpTarget = current.lead_id
    ? { kind: 'lead', id: current.lead_id }
    : { kind: 'application', id: current.application_id! };

  if (next) {
    const due = dateSchema.safeParse(next.dueDate);
    if (!due.success) return { ok: false, error: 'Choose a date for the next follow-up.' };
    if (due.data < (await todayFor(profile.organization_id!))) {
      return { ok: false, error: 'Choose today or a later date for the next follow-up.' };
    }
  }

  const { error } = await supabase
    .from('follow_ups')
    .update({ completed_at: new Date().toISOString(), completed_by: profile.id })
    .eq('id', followUpId)
    .is('completed_at', null);
  if (error) return { ok: false, error: 'Could not mark the follow-up done.' };

  await writeAuditLog({
    actorId: profile.id,
    organizationId: profile.organization_id,
    action: 'follow_up_completed',
    entity: 'follow_up',
    entityId: followUpId,
  });

  if (next) {
    const res = await setFollowUp(target, next);
    if (!res.ok) return { ok: false, error: `Marked done, but the next follow-up wasn't saved: ${res.error}` };
  }
  refresh(target);
  return { ok: true };
}

/** Remove an open follow-up that was set by mistake (done ones stay as history). */
export async function removeFollowUp(followUpId: string): Promise<FollowUpActionResult> {
  const profile = await requireUser();
  if (!z.string().uuid().safeParse(followUpId).success) return { ok: false, error: 'Invalid follow-up.' };

  const supabase = await createClient();
  const { data: removed, error } = await supabase
    .from('follow_ups')
    .delete()
    .eq('id', followUpId)
    .is('completed_at', null)
    .select('id, lead_id, application_id')
    .maybeSingle();
  if (error || !removed) return { ok: false, error: 'Could not remove the follow-up.' };

  await writeAuditLog({
    actorId: profile.id,
    organizationId: profile.organization_id,
    action: 'follow_up_removed',
    entity: 'follow_up',
    entityId: followUpId,
  });
  refresh(removed.lead_id ? { kind: 'lead', id: removed.lead_id } : { kind: 'application', id: removed.application_id! });
  return { ok: true };
}
