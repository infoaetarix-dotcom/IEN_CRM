'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireRole } from '@/lib/auth/guards';
import { writeAuditLog } from '@/lib/audit';

export interface AgentActionResult {
  ok: boolean;
  error?: string;
}

const createSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['admin', 'agent']),
});

/** Create a staff user (service role). Trigger auto-creates the profile. */
export async function createAgent(
  _prev: AgentActionResult,
  formData: FormData,
): Promise<AgentActionResult> {
  const admin = await requireRole('admin');
  const parsed = createSchema.safeParse({
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    password: formData.get('password'),
    role: formData.get('role'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]!.message };
  }

  const service = createServiceClient();
  const { data, error } = await service.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.full_name },
  });
  if (error || !data.user) {
    return { ok: false, error: error?.message ?? 'Could not create user.' };
  }

  // The trigger inserts the profile as 'agent'; set role + name + org. New
  // staff belong to the creating admin's organization.
  await service
    .from('profiles')
    .update({
      role: parsed.data.role,
      full_name: parsed.data.full_name,
      organization_id: admin.organization_id,
    })
    .eq('id', data.user.id);

  await writeAuditLog({
    actorId: admin.id,
    organizationId: admin.organization_id,
    action: 'profile_change',
    entity: 'profile',
    entityId: data.user.id,
    metadata: { created: true, role: parsed.data.role },
  });

  revalidatePath('/agents');
  return { ok: true };
}

export async function setAgentActive(
  id: string,
  isActive: boolean,
): Promise<AgentActionResult> {
  const admin = await requireRole('admin');
  if (id === admin.id) {
    return { ok: false, error: 'You cannot deactivate your own account.' };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', id);
  if (error) return { ok: false, error: 'Could not update.' };

  await writeAuditLog({
    actorId: admin.id,
    organizationId: admin.organization_id,
    action: 'profile_change',
    entity: 'profile',
    entityId: id,
    metadata: { is_active: isActive },
  });
  revalidatePath('/agents');
  return { ok: true };
}

export async function setAgentRole(
  id: string,
  role: 'admin' | 'agent',
): Promise<AgentActionResult> {
  const admin = await requireRole('admin');
  if (id === admin.id) {
    return { ok: false, error: 'You cannot change your own role.' };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', id);
  if (error) return { ok: false, error: 'Could not update role.' };

  await writeAuditLog({
    actorId: admin.id,
    organizationId: admin.organization_id,
    action: 'profile_change',
    entity: 'profile',
    entityId: id,
    metadata: { role },
  });
  revalidatePath('/agents');
  return { ok: true };
}
