import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Keep-warm ping. The free-tier Supabase project pauses after ~7 days idle,
 * which would silently stop the public form from accepting leads. A daily
 * Vercel cron (see vercel.json) calls this; the one cheap read counts as
 * activity and prevents the pause. Public, no secret, returns no data.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const svc = createServiceClient();
    const { error } = await svc.from('organizations').select('id').limit(1);
    if (error) return NextResponse.json({ ok: false }, { status: 500 });
    return NextResponse.json({ ok: true, at: new Date().toISOString() });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
