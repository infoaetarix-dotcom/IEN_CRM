'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit';
import { LAST_ORG_COOKIE } from '@/lib/auth/cookies';

export interface LoginState {
  error?: string;
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  // Generic message — never reveal whether the email exists (README §8.9).
  if (!parsed.success) {
    return { error: 'Please enter a valid email and password.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { error: 'Invalid credentials. Please try again.' };
  }

  // Confirm the profile is active before letting them in.
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_active, organization_id, is_super_admin')
    .eq('id', data.user.id)
    .single();

  if (!profile?.is_active) {
    await supabase.auth.signOut();
    return { error: 'This account is inactive. Contact an administrator.' };
  }

  await writeAuditLog({
    actorId: data.user.id,
    organizationId: profile.organization_id,
    action: 'login',
    entity: 'profile',
    entityId: data.user.id,
  });

  // Remember this org so /login and /forgot-password can show its theme
  // and logo next time, on this browser, before anyone's signed in.
  if (profile.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('slug')
      .eq('id', profile.organization_id)
      .single();
    if (org?.slug) {
      const jar = await cookies();
      jar.set(LAST_ORG_COOKIE, org.slug, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 90, // 90 days
        path: '/',
      });
    }
  }

  // Super admins land on the platform console; org staff on their dashboard.
  redirect(profile.is_super_admin ? '/super' : '/dashboard');
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
