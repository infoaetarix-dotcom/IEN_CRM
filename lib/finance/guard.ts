import 'server-only';

import { redirect } from 'next/navigation';
import { requireRole, type SessionProfile } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';

/**
 * The only two gates any Finance surface needs: admin role, and the org's
 * Finance module actually enabled. Shared by the page and every server
 * action so neither can be reached if either condition fails — mirrors the
 * "guards first, RLS second" pattern used everywhere else, since RLS alone
 * would only stop reads/writes, not rendering the page itself.
 */
export async function requireFinanceAccess(): Promise<SessionProfile> {
  const profile = await requireRole('admin');

  const supabase = await createClient();
  const { data } = await supabase
    .from('organization_modules')
    .select('enabled')
    .eq('organization_id', profile.organization_id)
    .eq('module_key', 'finance')
    .maybeSingle();

  if (!data?.enabled) redirect('/dashboard');
  return profile;
}
