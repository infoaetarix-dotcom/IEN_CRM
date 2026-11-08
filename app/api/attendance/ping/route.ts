import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/guards';
import { canClockIn, ping } from '@/lib/attendance/server';
import { clientIpFromHeaders } from '@/lib/attendance/ip';

export const dynamic = 'force-dynamic';

/**
 * "Still here" from an open CRM while clocked in (public/attendance-worker.js,
 * every 2 minutes). Keeps the session alive; if it had already gone stale it
 * comes back closed, and the top bar switches to "Clock in".
 */
export async function POST(request: NextRequest) {
  const profile = await requireUser();
  if (!(await canClockIn(profile))) return NextResponse.json({ ok: false }, { status: 403 });
  try {
    const state = await ping(profile as typeof profile & { organization_id: string }, clientIpFromHeaders(request.headers));
    return NextResponse.json({ ok: true, state });
  } catch (err) {
    console.error('[attendance] ping failed', err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
