import 'server-only';

import { redirect } from 'next/navigation';
import { requireRole, type SessionProfile } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

/**
 * Admin role + the org's Activity Tracker module enabled — same two gates as
 * Finance. Read-only surface: there's no corresponding write guard, because
 * writes never happen from this side (see 0021_activity_tracker.sql).
 */
export async function requireActivityAccess(): Promise<SessionProfile> {
  const profile = await requireRole('admin');

  const supabase = await createClient();
  const { data } = await supabase
    .from('organization_modules')
    .select('enabled')
    .eq('organization_id', profile.organization_id)
    .eq('module_key', 'activity_tracker')
    .maybeSingle();

  if (!data?.enabled) redirect('/dashboard');
  return profile;
}
