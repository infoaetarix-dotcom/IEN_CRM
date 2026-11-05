import 'server-only';

import { redirect } from 'next/navigation';
import { requireUser, type SessionProfile } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

/**
 * Team chat is an opt-in module (0051_team_chat.sql) a super admin turns
 * on per org. The page and every action check it here first; RLS and the
 * chat functions check it again in the database.
 */
export async function isTeamChatEnabled(organizationId: string | null): Promise<boolean> {
  if (!organizationId) return false;
  const { data } = await (await createClient())
    .from('organization_modules')
    .select('enabled')
    .eq('organization_id', organizationId)
    .eq('module_key', 'team_chat')
    .maybeSingle();
  return data?.enabled === true;
}

export async function requireTeamChat(): Promise<SessionProfile> {
  const profile = await requireUser();
  if (!(await isTeamChatEnabled(profile.organization_id))) redirect('/dashboard');
  return profile;
}
