import 'server-only';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type UserRole = 'admin' | 'agent';

export interface SessionProfile {
  id: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  is_super_admin: boolean;
  organization_id: string | null;
  email: string | null;
}

/**
 * Require an authenticated, active user. Redirects to /login otherwise.
 * Returns the user's profile — including org + super-admin — for downstream
 * authorization. RLS is the backstop; these checks are the first layer.
 */
export async function requireUser(): Promise<SessionProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active, is_super_admin, organization_id')
    .eq('id', user.id)
    .single();

  if (!profile || !profile.is_active) redirect('/login');

  return {
    ...(profile as Omit<SessionProfile, 'email'>),
    email: user.email ?? null,
  };
}

/**
 * Require a specific org role (defense-in-depth alongside RLS). Super admins
 * pass any role check. Redirects to the dashboard if the user lacks the role.
 */
export async function requireRole(role: UserRole): Promise<SessionProfile> {
  const profile = await requireUser();
  if (!profile.is_super_admin && profile.role !== role) redirect('/dashboard');
  return profile;
}

/** Require a platform super admin. Redirects non-super-admins to the dashboard. */
export async function requireSuperAdmin(): Promise<SessionProfile> {
  const profile = await requireUser();
  if (!profile.is_super_admin) redirect('/dashboard');
  return profile;
}
