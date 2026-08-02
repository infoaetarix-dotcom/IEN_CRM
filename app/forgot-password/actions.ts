'use server';

import { headers } from 'next/headers';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/service';
import { sendTransactionalEmail } from '@/lib/email/brevo';

export interface ResetRequestState {
  ok: boolean;
}

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

/**
 * Send a password-reset email.
 *
 * The link is minted server-side with the admin API and delivered through our
 * own Brevo transport — the same path the lead emails already use — instead of
 * Supabase's dashboard SMTP. That keeps auth email in version control, on our
 * own domain, and brandable per organization later (this is a multi-tenant
 * product; each consultancy should be able to have its own sender).
 *
 * Always reports success — never reveals whether an account exists.
 */
export async function requestPasswordReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const parsed = schema.safeParse({ email: formData.get('email') });
  if (!parsed.success) return { ok: true };
  const email = parsed.data.email;

  const h = await headers();
  const host = h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const origin = `${proto}://${host}`;

  try {
    const service = createServiceClient();
    const { data, error } = await service.auth.admin.generateLink({
      type: 'recovery',
      email,
    });

    // No account for that email (or link generation failed) — stay silent.
    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) return { ok: true };

    const link = `${origin}/auth/confirm?token_hash=${encodeURIComponent(
      tokenHash,
    )}&type=recovery&next=${encodeURIComponent('/update-password')}`;

    const name = (data.user?.user_metadata?.full_name as string | undefined) ?? '';

    await sendTransactionalEmail({
      to: email,
      toName: name || undefined,
      subject: 'Reset your CRM password',
      body: `${name ? `Hi ${name.split(' ')[0]},` : 'Hello,'}

We received a request to reset the password for your CRM account.

Open this link to choose a new password:
${link}

This link can only be used once and expires shortly. If you didn't request a password reset, you can safely ignore this email — your password won't change.`,
    });
  } catch {
    // Never surface internal failures to the caller (anti-enumeration).
  }

  return { ok: true };
}
