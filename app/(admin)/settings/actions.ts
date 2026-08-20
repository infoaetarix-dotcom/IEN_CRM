'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/guards';
import { writeAuditLog } from '@/lib/audit';

export interface SettingsActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

// Same shape as target_country elsewhere (lib/validation/lead.ts) — the
// CountryField combobox covers the full world country list, not just the
// short TARGET_COUNTRIES preset, so this stays a free non-empty string
// rather than a fixed enum.
const universitySchema = z.object({
  name: z.string().trim().min(1, 'Enter the university name').max(200),
  country: z.string().trim().min(1, 'Choose a country').max(80),
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
 * Create/update/delete a university in Settings. Any active admin or agent
 * may use all three — shared-data model, same as leads/applications/Student
 * Finance. RLS (universities_all) is the backstop.
 */
export async function createUniversity(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const profile = await requireUser();

  const parsed = universitySchema.safeParse({
    name: g(formData, 'name'),
    country: g(formData, 'country'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const supabase = await createClient();
  const { data: uni, error } = await supabase
    .from('universities')
    .insert({
      organization_id: profile.organization_id,
      name: parsed.data.name,
      country: parsed.data.country,
      created_by: profile.id,
    })
    .select('id')
    .single();
  if (error || !uni) return { ok: false, error: 'Could not save this university.' };

  await writeAuditLog({
    actorId: profile.id,
    organizationId: profile.organization_id,
    action: 'university_created',
    entity: 'university',
    entityId: uni.id,
    metadata: { name: parsed.data.name, country: parsed.data.country },
  });

  revalidatePath('/settings');
  return { ok: true };
}

export async function updateUniversity(
  universityId: string,
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const profile = await requireUser();

  const parsed = universitySchema.safeParse({
    name: g(formData, 'name'),
    country: g(formData, 'country'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('universities')
    .update({ name: parsed.data.name, country: parsed.data.country })
    .eq('id', universityId);
  if (error) return { ok: false, error: 'Could not update this university.' };

  await writeAuditLog({
    actorId: profile.id,
    organizationId: profile.organization_id,
    action: 'university_updated',
    entity: 'university',
    entityId: universityId,
    metadata: { name: parsed.data.name, country: parsed.data.country },
  });

  revalidatePath('/settings');
  return { ok: true };
}

export async function deleteUniversity(universityId: string): Promise<SettingsActionState> {
  const profile = await requireUser();

  const { error } = await (await createClient())
    .from('universities')
    .delete()
    .eq('id', universityId);
  if (error) return { ok: false, error: 'Could not delete this university.' };

  await writeAuditLog({
    actorId: profile.id,
    organizationId: profile.organization_id,
    action: 'university_deleted',
    entity: 'university',
    entityId: universityId,
  });

  revalidatePath('/settings');
  return { ok: true };
}
