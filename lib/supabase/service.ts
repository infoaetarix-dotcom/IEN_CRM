import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * SERVICE-ROLE client — bypasses RLS. Server-only, guarded by `server-only`.
 *
 * Use ONLY for:
 *  - the public form insert (the browser has no DB write access), and
 *  - atomic system writes (status history + audit) AFTER a server action has
 *    already verified the acting user's identity and authorization.
 *
 * Never import this from a client component. Never expose the key.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      'Missing Supabase service-role configuration (SUPABASE_SERVICE_ROLE_KEY).',
    );
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
