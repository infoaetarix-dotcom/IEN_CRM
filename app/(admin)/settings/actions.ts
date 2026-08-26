'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/guards';
import { writeAuditLog } from '@/lib/audit';
import { sanitizeSignatureHtml } from '@/lib/email/signatures';

export interface SettingsActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  universityId?: string;
}

export interface SignatureActionState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  signatureId?: string;
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
  return { ok: true, universityId: uni.id };
}

/**
 * Read-only name search — used by the AI assistant's find_university tool to
 * check whether a named university already exists before deciding to create
 * one. Nothing in the human UI needed this before (UniversityPicker is fed
 * the full list directly), so this is new rather than a reuse.
 */
export async function findUniversityByName(
  query: string,
): Promise<Array<{ id: string; name: string; country: string }>> {
  const profile = await requireUser();
  const q = query.trim();
  if (!q) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from('universities')
    .select('id, name, country')
    .eq('organization_id', profile.organization_id)
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(10);
  return data ?? [];
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

const signatureSchema = z.object({
  title: z.string().trim().min(1, 'Enter a title').max(100),
  body_html: z
    .string()
    .trim()
    .min(1, 'Signature cannot be empty')
    .refine((html) => html.replace(/<[^>]*>/g, '').trim().length > 0, 'Signature cannot be empty'),
});

/**
 * Create/update/delete an email signature and change which one is default.
 * Any active admin or agent may create/edit/delete EITHER a personal
 * signature (profile_id = themselves) or a shared "Common" one (profile_id
 * null) — shared-data model, same as universities above. RLS
 * (email_signatures_all) is the backstop.
 */
export async function createEmailSignature(
  _prev: SignatureActionState,
  formData: FormData,
): Promise<SignatureActionState> {
  const profile = await requireUser();

  const kindParsed = z.enum(['personal', 'shared']).safeParse(g(formData, 'kind'));
  if (!kindParsed.success) return { ok: false, error: 'Choose personal or shared.' };

  const parsed = signatureSchema.safeParse({
    title: g(formData, 'title'),
    body_html: g(formData, 'body_html'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const isShared = kindParsed.data === 'shared';
  const supabase = await createClient();

  // The first signature in this group (this person's own, or the org's
  // shared pool) automatically becomes the default — see 0037's partial
  // unique indexes for the invariant this relies on.
  let countQuery = supabase
    .from('email_signatures')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id);
  countQuery = isShared ? countQuery.is('profile_id', null) : countQuery.eq('profile_id', profile.id);
  const { count } = await countQuery;

  const { data: sig, error } = await supabase
    .from('email_signatures')
    .insert({
      organization_id: profile.organization_id,
      profile_id: isShared ? null : profile.id,
      title: parsed.data.title,
      body_html: sanitizeSignatureHtml(parsed.data.body_html),
      is_default: (count ?? 0) === 0,
      created_by: profile.id,
    })
    .select('id')
    .single();
  if (error || !sig) return { ok: false, error: 'Could not save this signature.' };

  await writeAuditLog({
    actorId: profile.id,
    organizationId: profile.organization_id,
    action: 'email_signature_created',
    entity: 'email_signature',
    entityId: sig.id,
    metadata: { title: parsed.data.title, shared: isShared },
  });

  revalidatePath('/settings');
  return { ok: true, signatureId: sig.id };
}

export async function updateEmailSignature(
  signatureId: string,
  _prev: SignatureActionState,
  formData: FormData,
): Promise<SignatureActionState> {
  const profile = await requireUser();

  const parsed = signatureSchema.safeParse({
    title: g(formData, 'title'),
    body_html: g(formData, 'body_html'),
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
    .from('email_signatures')
    .update({ title: parsed.data.title, body_html: sanitizeSignatureHtml(parsed.data.body_html) })
    .eq('id', signatureId);
  if (error) return { ok: false, error: 'Could not update this signature.' };

  await writeAuditLog({
    actorId: profile.id,
    organizationId: profile.organization_id,
    action: 'email_signature_updated',
    entity: 'email_signature',
    entityId: signatureId,
    metadata: { title: parsed.data.title },
  });

  revalidatePath('/settings');
  return { ok: true };
}

export async function deleteEmailSignature(signatureId: string): Promise<SignatureActionState> {
  const profile = await requireUser();

  const { error } = await (await createClient())
    .from('email_signatures')
    .delete()
    .eq('id', signatureId);
  if (error) return { ok: false, error: 'Could not delete this signature.' };

  await writeAuditLog({
    actorId: profile.id,
    organizationId: profile.organization_id,
    action: 'email_signature_deleted',
    entity: 'email_signature',
    entityId: signatureId,
  });

  revalidatePath('/settings');
  return { ok: true };
}

/**
 * Switches which signature is default within its own group (personal for
 * whoever owns it, or the org's shared pool) — two sequential updates
 * rather than one, since the partial unique indexes in 0037 are checked
 * per-statement: unset the current default first, then set the new one.
 */
export async function setDefaultSignature(signatureId: string): Promise<SignatureActionState> {
  const profile = await requireUser();
  const supabase = await createClient();

  const { data: target } = await supabase
    .from('email_signatures')
    .select('id, profile_id, organization_id')
    .eq('id', signatureId)
    .maybeSingle();
  if (!target) return { ok: false, error: 'Signature not found or access denied.' };

  let unsetQuery = supabase
    .from('email_signatures')
    .update({ is_default: false })
    .eq('organization_id', target.organization_id)
    .eq('is_default', true);
  unsetQuery = target.profile_id
    ? unsetQuery.eq('profile_id', target.profile_id)
    : unsetQuery.is('profile_id', null);
  const { error: unsetErr } = await unsetQuery;
  if (unsetErr) return { ok: false, error: 'Could not update the default signature.' };

  const { error: setErr } = await supabase
    .from('email_signatures')
    .update({ is_default: true })
    .eq('id', signatureId);
  if (setErr) return { ok: false, error: 'Could not update the default signature.' };

  await writeAuditLog({
    actorId: profile.id,
    organizationId: profile.organization_id,
    action: 'email_signature_default_changed',
    entity: 'email_signature',
    entityId: signatureId,
  });

  revalidatePath('/settings');
  return { ok: true };
}
