'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireStudentFinanceAccess } from '@/lib/finance/student-guard';
import { writeAuditLog } from '@/lib/audit';

export interface StudentFinanceActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const entrySchema = z.object({
  lead_id: z.string().uuid('Choose which student this payment is for'),
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number().positive('Enter an amount greater than zero'),
  category: z.string().trim().min(1, 'Choose or enter a category').max(80),
  payment_method: z.string().trim().max(40).optional(),
  note: z.string().trim().max(2000).optional(),
  entry_date: z.string().min(1, 'Pick a date'),
});

function fieldErrorsFrom(
  issues: { path: (string | number)[]; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path[0];
    if (typeof key === 'string' && !out[key]) out[key] = i.message;
  }
  return out;
}

const g = (f: FormData, k: string) => (f.get(k) ?? '') as string;

/**
 * Create/update/delete a shared Student Finance entry. Any active admin or
 * agent in the org may use all three (shared-data model, same as leads and
 * applications) — RLS (student_finance_entries_all) is the backstop.
 */
export async function createStudentFinanceEntry(
  _prev: StudentFinanceActionState,
  formData: FormData,
): Promise<StudentFinanceActionState> {
  const profile = await requireStudentFinanceAccess();

  const parsed = entrySchema.safeParse({
    lead_id: g(formData, 'lead_id'),
    type: g(formData, 'type'),
    amount: g(formData, 'amount'),
    category: g(formData, 'category'),
    payment_method: g(formData, 'payment_method') || undefined,
    note: g(formData, 'note') || undefined,
    entry_date: g(formData, 'entry_date'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { data: entry, error } = await supabase
    .from('student_finance_entries')
    .insert({
      organization_id: profile.organization_id,
      lead_id: d.lead_id,
      type: d.type,
      amount: d.amount,
      category: d.category,
      payment_method: d.payment_method || null,
      note: d.note || null,
      entry_date: d.entry_date,
      created_by: profile.id,
    })
    .select('id')
    .single();
  if (error || !entry) return { ok: false, error: 'Could not save this entry.' };

  await writeAuditLog({
    actorId: profile.id,
    organizationId: profile.organization_id,
    action: 'student_finance_entry_created',
    entity: 'student_finance_entry',
    entityId: entry.id,
    metadata: { lead_id: d.lead_id, type: d.type, amount: d.amount, category: d.category },
  });

  revalidatePath('/student-finance');
  return { ok: true };
}

export async function updateStudentFinanceEntry(
  entryId: string,
  _prev: StudentFinanceActionState,
  formData: FormData,
): Promise<StudentFinanceActionState> {
  const profile = await requireStudentFinanceAccess();

  const parsed = entrySchema.safeParse({
    lead_id: g(formData, 'lead_id'),
    type: g(formData, 'type'),
    amount: g(formData, 'amount'),
    category: g(formData, 'category'),
    payment_method: g(formData, 'payment_method') || undefined,
    note: g(formData, 'note') || undefined,
    entry_date: g(formData, 'entry_date'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from('student_finance_entries')
    .update({
      lead_id: d.lead_id,
      type: d.type,
      amount: d.amount,
      category: d.category,
      payment_method: d.payment_method || null,
      note: d.note || null,
      entry_date: d.entry_date,
    })
    .eq('id', entryId);
  if (error) return { ok: false, error: 'Could not update this entry.' };

  await writeAuditLog({
    actorId: profile.id,
    organizationId: profile.organization_id,
    action: 'student_finance_entry_updated',
    entity: 'student_finance_entry',
    entityId: entryId,
    metadata: { lead_id: d.lead_id, type: d.type, amount: d.amount, category: d.category },
  });

  revalidatePath('/student-finance');
  return { ok: true };
}

export async function deleteStudentFinanceEntry(
  entryId: string,
): Promise<StudentFinanceActionState> {
  const profile = await requireStudentFinanceAccess();

  const { error } = await (await createClient())
    .from('student_finance_entries')
    .delete()
    .eq('id', entryId);
  if (error) return { ok: false, error: 'Could not delete this entry.' };

  await writeAuditLog({
    actorId: profile.id,
    organizationId: profile.organization_id,
    action: 'student_finance_entry_deleted',
    entity: 'student_finance_entry',
    entityId: entryId,
  });

  revalidatePath('/student-finance');
  return { ok: true };
}
