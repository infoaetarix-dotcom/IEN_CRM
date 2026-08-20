import 'server-only';

import { redirect } from 'next/navigation';
import { requireUser, type SessionProfile } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

/**
 * The only two gates Student Finance needs: an active session (admin OR
 * agent — this ledger is shared, unlike the private per-admin one in
 * lib/finance/guard.ts), and the org's Student Finance module enabled.
 * Shared by the page and every server action, mirroring requireFinanceAccess.
 */
export async function requireStudentFinanceAccess(): Promise<SessionProfile> {
  const profile = await requireUser();

  const supabase = await createClient();
  const { data } = await supabase
    .from('organization_modules')
    .select('enabled')
    .eq('organization_id', profile.organization_id)
    .eq('module_key', 'student_finance')
    .maybeSingle();

  if (!data?.enabled) redirect('/dashboard');
  return profile;
}
