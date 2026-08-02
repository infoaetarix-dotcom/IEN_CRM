'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

export interface ResetRequestState {
  ok: boolean;
}

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

/**
 * Send a password-reset email. Always reports success — never reveals whether
 * an account exists (anti-enumeration). The reset link lands on /auth/callback,
 * which exchanges the code for a session and forwards to /update-password.
 */
export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const parsed = schema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { ok: true };

  const h = await headers();
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const origin = `${proto}://${host}`;

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/update-password`,
  });

  return { ok: true };
}
