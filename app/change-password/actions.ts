'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireUser } from '@/lib/auth/guards';
import { writeAuditLog } from '@/lib/audit';

export interface ChangePasswordResult {
  ok: boolean;
  error?: string;
}

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password is too long'),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  });

/**
 * Change the signed-in user's password. Works for any authenticated user
 * (agent or admin) via the Supabase auth API, then clears the force-change flag
 * with the service role (an agent can't write their own profile row under RLS).
 */
export async function changePassword(
  password: string,
  confirm: string,
): Promise<ChangePasswordResult> {
  const user = await requireUser();

  const parsed = schema.safeParse({ password, confirm });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]!.message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) return { ok: false, error: error.message };

  const service = createServiceClient();
  await service
    .from('profiles')
    .update({ must_change_password: false })
    .eq('id', user.id);

  await writeAuditLog({
    actorId: user.id,
    organizationId: user.organization_id,
    action: 'profile_change',
    entity: 'profile',
    entityId: user.id,
    metadata: { password_changed: true },
  });

  return { ok: true };
}
