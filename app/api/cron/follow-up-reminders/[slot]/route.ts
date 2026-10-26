import { NextResponse, type NextRequest } from 'next/server';
import { runFollowUpReminders } from '@/lib/follow-ups/reminders';

/**
 * Follow-up reminder cron — /api/cron/follow-up-reminders/morning and
 * /afternoon, scheduled in vercel.json (about 9am and 3pm Pakistan time).
 * Emails every active staff member a summary of follow-ups due today or
 * overdue; the afternoon run only finds the ones still not marked done.
 *
 * It sends email, so it is NOT public: Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET`, and anything else is refused.
 * With no CRON_SECRET configured it refuses everything (fails closed).
 * Its database reads also keep the free-tier Supabase project awake,
 * which is why it replaced the old daily /api/keep-warm cron.
 */
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slot: string }> }) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: 'CRON_SECRET is not configured' }, { status: 500 });
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { slot } = await params;
  if (slot !== 'morning' && slot !== 'afternoon') {
    return NextResponse.json({ ok: false, error: 'Unknown slot' }, { status: 404 });
  }

  try {
    const results = await runFollowUpReminders(slot, new Date());
    return NextResponse.json({ ok: true, slot, results });
  } catch (err) {
    console.error('[follow-up-reminders] failed', err);
    return NextResponse.json({ ok: false, error: 'Reminder run failed' }, { status: 500 });
  }
}
