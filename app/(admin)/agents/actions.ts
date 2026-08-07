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
});

/**
 * Create a staff user (service role). Trigger auto-creates the profile.
 * Always creates an agent — an org admin can never create or promote another
 * admin; admins are provisioned exclusively by the super admin at org signup.
 */
export async function createAgent(
  _prev: AgentActionResult,
  formData: FormData,
): Promise<AgentActionResult> {
  const admin = await requireRole('admin');
  const parsed = createSchema.safeParse({
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    password: formData.get('password'),
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

  // The trigger inserts the profile as 'agent'; set name + org. New staff
  // belong to the creating admin's organization and must change the
  // temporary password on first login.
  await service
    .from('profiles')
    .update({
      role: 'agent',
      full_name: parsed.data.full_name,
      organization_id: admin.organization_id,
      must_change_password: true,
    })
    .eq('id', data.user.id);

  await writeAuditLog({
    actorId: admin.id,
    organizationId: admin.organization_id,
    action: 'profile_change',
    entity: 'profile',
    entityId: data.user.id,
    metadata: { created: true, role: 'agent' },
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

