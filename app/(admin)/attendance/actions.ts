'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/guards';
import { canClockIn, clockIn as doClockIn, clockOut as doClockOut, type ClockState } from '@/lib/attendance/server';
import { clientIpFromHeaders } from '@/lib/attendance/ip';

export interface ClockResult {
  ok: boolean;
  error?: string;
  state?: ClockState;
}

/**
 * The top bar's Clock in / Clock out. Agents only, module on. The IP (and
 * so office or remote) is read here on the server, never sent by the page.
 */
async function run(action: typeof doClockIn): Promise<ClockResult> {
  const profile = await requireUser();
  if (!(await canClockIn(profile))) return { ok: false, error: 'Attendance isn’t available for your account.' };
  try {
    const state = await action(profile as typeof profile & { organization_id: string }, clientIpFromHeaders(await headers()));
    revalidatePath('/attendance');
    return { ok: true, state };
  } catch (err) {
    console.error('[attendance] clock action failed', err);
    return { ok: false, error: 'Could not save that. Please try again.' };
  }
}

export async function clockIn(): Promise<ClockResult> {
  return run(doClockIn);
}

export async function clockOut(): Promise<ClockResult> {
  return run(doClockOut);
}
