import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser client bound to the signed-in user's session (anon key + cookies,
 * same session the server client reads) — for client components that need
 * live data via Supabase Realtime rather than a one-shot server-rendered
 * read. RLS filters rows automatically, same as the server client.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
