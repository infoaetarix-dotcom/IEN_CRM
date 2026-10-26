'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Check } from 'lucide-react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  setFollowUp,
  completeFollowUp,
  removeFollowUp,
  type FollowUpTarget,
  type FollowUpActionResult,
} from '@/app/(admin)/follow-ups/actions';
import { addDays, followUpState, formatDueDate } from '@/lib/follow-ups/status';
import type { OpenFollowUp } from '@/lib/follow-ups/load';

// Calendar works in local Date objects; follow-ups are plain YYYY-MM-DD.
const toDate = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
};
const toKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const TONE = {
  none: 'border-tenant-ink/15 bg-white text-muted-foreground hover:bg-tenant-gray',
  upcoming: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100',
  today: 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100',
  overdue: 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100',
} as const;

/**
 * Calendar button for a lead / application row (or a detail page): set or
 * move the follow-up date, add a note, and — the only way a follow-up
 * closes — mark it done, optionally scheduling the next one in one step.
 */
export function FollowUpButton({
  target,
  name,
  followUp,
  todayKey,
  variant = 'icon',
}: {
  target: FollowUpTarget;
  name: string;
  followUp: OpenFollowUp | null;
  /** Today in the org's time zone (YYYY-MM-DD). */
  todayKey: string;
  variant?: 'icon' | 'button';
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // 'edit' = set / move; 'next' = just marked done, offer the next date.
  const [step, setStep] = useState<'edit' | 'next'>('edit');
  const [date, setDate] = useState(followUp?.due_date ?? addDays(todayKey, 1));
  const [note, setNote] = useState(followUp?.note ?? '');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const state = followUp ? followUpState(followUp.due_date, todayKey) : null;
  const tone = state?.kind ?? 'none';

  function reset() {
    setStep('edit');
    setDate(followUp?.due_date ?? addDays(todayKey, 1));
    setNote(followUp?.note ?? '');
    setError(null);
  }

  function run(action: () => Promise<FollowUpActionResult>) {
    setError(null);
    start(async () => {
      const res = await action();
      if (!res.ok) {
        setError(res.error ?? 'Something went wrong.');
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  const quick = (label: string, days: number) => (
    <button
      key={label}
      type="button"
      onClick={() => setDate(addDays(todayKey, days))}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs transition-colors',
        date === addDays(todayKey, days)
          ? 'border-tenant-accent bg-tenant-accent text-white'
          : 'border-tenant-ink/15 text-tenant-ink hover:bg-tenant-gray',
      )}
    >
      {label}
    </button>
  );

  const picker = (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {quick('Today', 0)}
        {quick('Tomorrow', 1)}
        {quick('In 3 days', 3)}
        {quick('In 1 week', 7)}
        {quick('In 2 weeks', 14)}
      </div>
      <div className="rounded-lg border border-tenant-ink/10">
        <Calendar
          mode="single"
          selected={toDate(date)}
          onSelect={(d) => d && setDate(toKey(d))}
          defaultMonth={toDate(date)}
          fromDate={toDate(todayKey)}
          toYear={toDate(todayKey).getFullYear() + 3}
          disabled={{ before: toDate(todayKey) }}
        />
      </div>
      <p className="text-sm text-tenant-ink">
        Follow up on <strong>{formatDueDate(date)}</strong>
      </p>
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) reset();
      }}
    >
      <DialogTrigger asChild>
        {variant === 'icon' ? (
          <button
            type="button"
            title={state ? state.label : 'Set follow-up'}
            aria-label={state ? state.label : 'Set follow-up'}
            className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors', TONE[tone])}
          >
            <CalendarClock className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            className={cn('inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors', TONE[tone])}
          >
            <CalendarClock className="h-4 w-4" />
            {followUp ? 'Change follow-up' : 'Set follow-up'}
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-tenant-display text-tenant-ink">
            {step === 'next' ? 'Set the next follow-up?' : 'Follow-up'}
          </DialogTitle>
          <DialogDescription>
            {step === 'next'
              ? `This follow-up for ${name} will be marked done.`
              : state
                ? `${name} · ${state.label}`
                : `Pick a day to follow up with ${name}. Everyone on the team gets a reminder that morning.`}
          </DialogDescription>
        </DialogHeader>

        {step === 'edit' ? (
          <div className="space-y-4">
            {picker}
            <div>
              <Label htmlFor="follow_up_note">Note (optional)</Label>
              <Textarea
                id="follow_up_note"
                value={note}
                maxLength={500}
                rows={2}
                placeholder="e.g. Call about IELTS result"
                onChange={(e) => setNote(e.target.value)}
                className="mt-1.5"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                disabled={pending}
                className="bg-tenant-accent text-white hover:bg-tenant-accent/90"
                onClick={() => run(() => setFollowUp(target, { dueDate: date, note }))}
              >
                {pending ? 'Saving…' : followUp ? 'Save changes' : 'Set follow-up'}
              </Button>
              {followUp && (
                <Button
                  type="button"
                  disabled={pending}
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => {
                    setError(null);
                    setDate(addDays(todayKey, 3));
                    setNote('');
                    setStep('next');
                  }}
                >
                  <Check className="mr-1 h-4 w-4" /> Mark done
                </Button>
              )}
              {followUp && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (confirm('Remove this follow-up? Use “Mark done” instead if you followed up.')) {
                      run(() => removeFollowUp(followUp.id));
                    }
                  }}
                  className="ml-auto text-sm text-red-600 hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {picker}
            <div>
              <Label htmlFor="follow_up_next_note">Note (optional)</Label>
              <Textarea
                id="follow_up_next_note"
                value={note}
                maxLength={500}
                rows={2}
                onChange={(e) => setNote(e.target.value)}
                className="mt-1.5"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={pending}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => run(() => completeFollowUp(followUp!.id, { dueDate: date, note }))}
              >
                {pending ? 'Saving…' : 'Done + set next'}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => run(() => completeFollowUp(followUp!.id))}
              >
                Just mark done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** The coloured tag under a row's name: Today / Overdue / upcoming date. */
export function FollowUpTag({ followUp, todayKey }: { followUp: OpenFollowUp | null; todayKey: string }) {
  if (!followUp) return null;
  const s = followUpState(followUp.due_date, todayKey);
  return (
    <span
      title={followUp.note ?? undefined}
      className={cn(
        'mt-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium',
        TONE[s.kind],
      )}
    >
      <CalendarClock className="h-3 w-3" />
      {s.label}
    </span>
  );
}
