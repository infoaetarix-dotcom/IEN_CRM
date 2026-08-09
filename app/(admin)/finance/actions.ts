'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireFinanceAccess } from '@/lib/finance/guard';
import { writeAuditLog } from '@/lib/audit';

export interface FinanceActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const entrySchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.coerce.number().positive('Enter an amount greater than zero'),
  category: z.string().trim().min(1, 'Choose or enter a category').max(80),
  payment_method: z.string().trim().max(40).optional(),
  note: z.string().trim().max(2000).optional(),
  entry_date: z.string().min(1, 'Pick a date'),
  lead_id: z.string().uuid().optional().or(z.literal('')),
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

export async function createFinanceEntry(
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const profile = await requireFinanceAccess();

  const parsed = entrySchema.safeParse({
    type: g(formData, 'type'),
    amount: g(formData, 'amount'),
    category: g(formData, 'category'),
    payment_method: g(formData, 'payment_method') || undefined,
    note: g(formData, 'note') || undefined,
    entry_date: g(formData, 'entry_date'),
    lead_id: g(formData, 'lead_id'),
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
    .from('finance_entries')
    .insert({
      organization_id: profile.organization_id,
      user_id: profile.id,
      type: d.type,
      amount: d.amount,
      category: d.category,
      payment_method: d.payment_method || null,
      note: d.note || null,
      entry_date: d.entry_date,
      lead_id: d.lead_id || null,
    })
    .select('id')
    .single();
  if (error || !entry) {
    return { ok: false, error: 'Could not save this entry.' };
  }

  await writeAuditLog({
    actorId: profile.id,
    organizationId: profile.organization_id,
    action: 'finance_entry_created',
    entity: 'finance_entry',
    entityId: entry.id,
    metadata: { type: d.type, amount: d.amount, category: d.category },
  });

  revalidatePath('/finance');
  return { ok: true };
}

export async function updateFinanceEntry(
  entryId: string,
  _prev: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const profile = await requireFinanceAccess();

  const parsed = entrySchema.safeParse({
    type: g(formData, 'type'),
    amount: g(formData, 'amount'),
    category: g(formData, 'category'),
    payment_method: g(formData, 'payment_method') || undefined,
    note: g(formData, 'note') || undefined,
    entry_date: g(formData, 'entry_date'),
    lead_id: g(formData, 'lead_id'),
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
    .from('finance_entries')
    .update({
      type: d.type,
      amount: d.amount,
      category: d.category,
      payment_method: d.payment_method || null,
      note: d.note || null,
      entry_date: d.entry_date,
      lead_id: d.lead_id || null,
    })
    .eq('id', entryId)
    .eq('user_id', profile.id); // defense-in-depth alongside RLS
  if (error) return { ok: false, error: 'Could not update this entry.' };

  await writeAuditLog({
    actorId: profile.id,
    organizationId: profile.organization_id,
    action: 'finance_entry_updated',
    entity: 'finance_entry',
    entityId: entryId,
    metadata: { type: d.type, amount: d.amount, category: d.category },
  });

  revalidatePath('/finance');
  return { ok: true };
}

export async function deleteFinanceEntry(entryId: string): Promise<FinanceActionState> {
  const profile = await requireFinanceAccess();

  const { error } = await (await createClient())
    .from('finance_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', profile.id);
  if (error) return { ok: false, error: 'Could not delete this entry.' };

  await writeAuditLog({
    actorId: profile.id,
    organizationId: profile.organization_id,
    action: 'finance_entry_deleted',
    entity: 'finance_entry',
    entityId: entryId,
  });

  revalidatePath('/finance');
  return { ok: true };
}
