'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { Building2, Home, LogIn, LogOut, X } from 'lucide-react';
import { clockIn, clockOut } from '@/app/(admin)/attendance/actions';
import type { ClockState } from '@/lib/attendance/server';
import { formatClock } from '@/lib/attendance/records';
import { cn } from '@/lib/utils';

const PING_URL = '/api/attendance/ping';
// Mirrors PING_MS in lib/attendance/server.ts (a server-only module).
const PING_MS = 2 * 60 * 1000;

function noteKey(at: string) {
  return `attendance-auto-note:${at}`;
}

/**
 * Clock in / Clock out in the top bar (agents, Attendance module on).
 * One click each — no dialog. While clocked in it shows today's running
 * total and where the clock-in came from (office or remote, decided on the
 * server from the IP), and a background worker pings every 2 minutes so the
 * server can tell when the CRM was closed (see lib/attendance/server.ts).
 */
export function AttendanceClock({ initial }: { initial: ClockState }) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [, setTick] = useState(0);
  const [noteHidden, setNoteHidden] = useState(false);
  // Server time minus this computer's time, so the timer follows the
  // server's clock even if the laptop's is wrong.
  const offset = useRef(Date.parse(initial.serverNow) - Date.now());
  const worker = useRef<Worker | null>(null);

  const apply = useCallback((next: ClockState) => {
    offset.current = Date.parse(next.serverNow) - Date.now();
    setState(next);
  }, []);

  // A router.refresh() re-renders the layout with fresh server state.
  useEffect(() => apply(initial), [initial, apply]);

  useEffect(() => {
    if (!state.autoClosedAt) return;
    try {
      setNoteHidden(window.localStorage.getItem(noteKey(state.autoClosedAt)) === '1');
    } catch {
      setNoteHidden(false);
    }
  }, [state.autoClosedAt]);

  const clockedIn = !!state.open;

  // Pings only while clocked in.
  useEffect(() => {
    if (!clockedIn) return;
    const onReply = (data: { ok?: boolean; state?: ClockState }) => {
      if (data?.ok && data.state) apply(data.state);
    };
    let fallback: ReturnType<typeof setInterval> | null = null;
    const beatOnMainThread = () =>
      fetch(PING_URL, { method: 'POST', credentials: 'same-origin', cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && onReply(d))
        .catch(() => {});

    try {
      const w = new Worker('/attendance-worker.js');
      w.onmessage = (e) => onReply(e.data);
      w.postMessage({ type: 'start', url: new URL(PING_URL, window.location.origin).href, intervalMs: PING_MS });
      worker.current = w;
    } catch {
      fallback = setInterval(beatOnMainThread, PING_MS);
    }

    // Back on the tab (or the laptop woke up): check in straight away, so
    // a session that ended while asleep shows as ended at once.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (worker.current) worker.current.postMessage({ type: 'beat' });
      else beatOnMainThread();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (fallback) clearInterval(fallback);
      worker.current?.terminate();
      worker.current = null;
    };
  }, [clockedIn, apply]);

  // Tick the clock every second while clocked in; once a minute otherwise
  // (so the day's total resets at midnight without a reload).
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), clockedIn ? 1000 : 60_000);
    return () => clearInterval(t);
  }, [clockedIn]);

  const now = Date.now() + offset.current;
  const dayOver = now >= Date.parse(state.dayEndsAt);
  const total =
    (dayOver && !clockedIn ? 0 : state.closedSecondsToday) +
    (state.open ? Math.max(0, (now - Date.parse(state.open.clockInAt)) / 1000) : 0);

  function act(fn: typeof clockIn) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.ok && res.state) apply(res.state);
      else setError(res.error ?? 'Could not save that. Please try again.');
    });
  }

  const showNote = !clockedIn && !dayOver && !!state.autoClosedAt && !noteHidden;
  const autoTime = state.autoClosedAt
    ? new Date(state.autoClosedAt).toLocaleTimeString('en-GB', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: state.timezone,
      })
    : '';

  const btn =
    'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-60';

  return (
    <div className="relative flex items-center gap-2">
      {clockedIn ? (
        <>
          <span
            role="timer"
            aria-label={`Clocked in from ${state.open!.place}, ${formatClock(total)} today`}
            title={state.open!.place === 'office' ? 'Clocked in from the office network' : 'Clocked in remotely'}
            className="hidden items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm text-tenant-offwhite sm:inline-flex"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
            {state.open!.place === 'office' ? (
              <Building2 className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Home className="h-3.5 w-3.5" aria-hidden />
            )}
            <span>{state.open!.place === 'office' ? 'Office' : 'Remote'}</span>
            <span className="font-mono tabular-nums">{formatClock(total)}</span>
          </span>
          <button
            type="button"
            onClick={() => act(clockOut)}
            disabled={pending}
            className={cn(btn, 'bg-white/10 text-tenant-offwhite hover:bg-white/15')}
          >
            <LogOut className="h-4 w-4" />
            {/* Phones: the button carries the timer, to save space. */}
            <span className="font-mono tabular-nums sm:hidden">{formatClock(total)}</span>
            <span className="hidden sm:inline">{pending ? 'Saving…' : 'Clock out'}</span>
            <span className="sr-only sm:hidden">Clock out</span>
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => act(clockIn)}
          disabled={pending}
          className={cn(btn, 'bg-emerald-500 text-white hover:bg-emerald-600')}
        >
          <LogIn className="h-4 w-4" />
          {pending ? 'Saving…' : 'Clock in'}
        </button>
      )}

      {(showNote || error) && (
        <div
          role={error ? 'alert' : 'status'}
          className="absolute right-0 top-full z-50 mt-2 flex w-max max-w-[260px] items-start gap-2 rounded-lg bg-white px-3 py-2 text-xs text-tenant-ink shadow-lg ring-1 ring-black/5"
        >
          <span>{error ?? `Auto clocked out at ${autoTime} — the CRM was closed.`}</span>
          <button
            type="button"
            aria-label="Dismiss"
            className="text-muted-foreground hover:text-tenant-ink"
            onClick={() => {
              if (error) return setError(null);
              setNoteHidden(true);
              try {
                window.localStorage.setItem(noteKey(state.autoClosedAt!), '1');
              } catch {
                /* the note just comes back next time */
              }
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
