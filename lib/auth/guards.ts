import 'server-only';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type UserRole = 'admin' | 'agent';

export interface SessionProfile {
  id: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  email: string | null;
}

/**
 * Require an authenticated, active user. Redirects to /login otherwise.
 * Returns the user's profile (role included) for downstream authorization.
 */
export async function requireUser(): Promise<SessionProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.is_active) redirect('/login');

  return { ...(profile as Omit<SessionProfile, 'email'>), email: user.email ?? null };
}

/**
 * Require a specific role (defense-in-depth alongside RLS). Redirects to the
 * dashboard if the user is authenticated but lacks the role.
 */
export async function requireRole(role: UserRole): Promise<SessionProfile> {
  const profile = await requireUser();
  if (profile.role !== role) redirect('/dashboard');
  return profile;
}
