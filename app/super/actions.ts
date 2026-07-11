'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { writeAuditLog } from '@/lib/audit';
import { DEFAULT_TEMPLATES } from '@/lib/org/defaults';

export interface SuperResult {
  ok: boolean;
  error?: string;
}

const createSchema = z.object({
  name: z.string().trim().min(2, 'Organisation name is required').max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,40}$/, 'Slug: 2–40 lowercase letters, numbers or hyphens'),
  admin_name: z.string().trim().min(2, "Admin's name is required").max(120),
  admin_email: z.string().trim().toLowerCase().email('Valid admin email required'),
  admin_password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * Provision a new consultancy: org + enabled modules + seeded templates + its
 * first admin. Super-admin only. All writes via service role after the guard.
 */
export async function createOrganization(
  _prev: SuperResult,
  formData: FormData,
): Promise<SuperResult> {
  const superAdmin = await requireSuperAdmin();

  const parsed = createSchema.safeParse({
    name: formData.get('name'),
    slug: formData.get('slug'),
    admin_name: formData.get('admin_name'),
    admin_email: formData.get('admin_email'),
    admin_password: formData.get('admin_password'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]!.message };
  }
  const d = parsed.data;
  const modules = formData.getAll('modules').map(String).filter(Boolean);

  const service = createServiceClient();

  // Slug must be unique.
  const { data: existing } = await service
    .from('organizations')
    .select('id')
    .eq('slug', d.slug)
    .maybeSingle();
  if (existing) return { ok: false, error: `Slug "${d.slug}" is already taken.` };

  // 1. Organization
  const { data: org, error: orgErr } = await service
    .from('organizations')
    .insert({ name: d.name, slug: d.slug })
    .select('id')
    .single();
  if (orgErr || !org) {
    return { ok: false, error: orgErr?.message ?? 'Could not create organisation.' };
  }
  const orgId = org.id as string;

  // 2. Modules (package)
  if (modules.length) {
    await service.from('organization_modules').insert(
      modules.map((m) => ({ organization_id: orgId, module_key: m })),
    );
  }

  // 3. Seed email templates for this org
  await service.from('email_templates').insert(
    DEFAULT_TEMPLATES.map((t) => ({ ...t, organization_id: orgId })),
  );

  // 4. First admin
  const { data: user, error: userErr } = await service.auth.admin.createUser({
    email: d.admin_email,
    password: d.admin_password,
    email_confirm: true,
    user_metadata: { full_name: d.admin_name },
  });
  if (userErr || !user.user) {
    // Roll back the org so we don't leave a half-created tenant.
    await service.from('organizations').delete().eq('id', orgId);
    return { ok: false, error: userErr?.message ?? 'Could not create the admin user.' };
  }
  await service
    .from('profiles')
    .update({ role: 'admin', full_name: d.admin_name, organization_id: orgId })
    .eq('id', user.user.id);

  await writeAuditLog({
    actorId: superAdmin.id,
    organizationId: orgId,
    action: 'org_change',
    entity: 'organization',
    entityId: orgId,
    metadata: { created: true, slug: d.slug, modules },
  });

  revalidatePath('/super');
  return { ok: true };
}

/** Suspend or reactivate a consultancy. */
export async function setOrgStatus(
  orgId: string,
  status: 'active' | 'suspended',
): Promise<SuperResult> {
  const superAdmin = await requireSuperAdmin();
  const service = createServiceClient();
  const { error } = await service
    .from('organizations')
    .update({ status })
    .eq('id', orgId);
  if (error) return { ok: false, error: 'Could not update status.' };

  await writeAuditLog({
    actorId: superAdmin.id,
    organizationId: orgId,
    action: 'org_change',
    entity: 'organization',
    entityId: orgId,
    metadata: { status },
  });
  revalidatePath('/super');
  revalidatePath(`/super/orgs/${orgId}`);
  return { ok: true };
}

/** Enable or disable a module for a consultancy (packaging). */
export async function toggleModule(
  orgId: string,
  moduleKey: string,
  enabled: boolean,
): Promise<SuperResult> {
  const superAdmin = await requireSuperAdmin();
  const service = createServiceClient();
  const { error } = await service.from('organization_modules').upsert(
    { organization_id: orgId, module_key: moduleKey, enabled },
    { onConflict: 'organization_id,module_key' },
  );
  if (error) return { ok: false, error: 'Could not update module.' };

  await writeAuditLog({
    actorId: superAdmin.id,
    organizationId: orgId,
    action: 'module_change',
    entity: 'organization',
    entityId: orgId,
    metadata: { module: moduleKey, enabled },
  });
  revalidatePath(`/super/orgs/${orgId}`);
  return { ok: true };
}
