import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * Keep-warm ping. The free-tier Supabase project pauses after ~7 days idle,
 * which would silently stop the public form from accepting leads. The one
 * cheap read counts as activity. Public, no secret, returns no data.
 *
 * It's no longer scheduled: the follow-up reminder crons
 * (/api/cron/follow-up-reminders, twice a day in vercel.json) read the
 * database too and keep it awake. This stays for manual pings.
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
