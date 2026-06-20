'use client';

import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser client — auth only, uses the anon key. RLS governs every row this
 * client can ever see. It must NEVER be given write access to lead data; the
 * public form writes server-side via the service role.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
