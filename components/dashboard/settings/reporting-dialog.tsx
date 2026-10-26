'use client';

import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarRange, Pencil, Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  saveReportingPeriod,
  deleteReportingPeriod,
  addCommonReportingPeriods,
  saveReportingTimezone,
  type ReportingActionState,
} from '@/app/(admin)/settings/reporting-actions';
import { MONTH_NAMES, monthName, periodMonthsLabel } from '@/lib/reports/time';
import type { ReportingPeriod } from '@/lib/reports/settings';

const init: ReportingActionState = { ok: false };

/**
 * Settings → Reporting tile: the org's lead reporting periods (e.g. Jan–Feb,
 * reported in March) and the time zone reports count days in. Everyone can
 * see the setup; only admins can change it.
 */
export function ReportingDialog({
  periods,
  timezone,
  isAdmin,
}: {
  periods: ReportingPeriod[];
  timezone: string;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // null = list view; 'new' = adding; otherwise the id being edited.
  const [editing, setEditing] = useState<string | null>(null);

  function run(action: () => Promise<ReportingActionState>) {
    setError(null);
    start(async () => {
      const res = await action();
      if (!res.ok) setError(res.error ?? 'Something went wrong.');
      router.refresh();
    });
  }

  return (
    <Dialog onOpenChange={(open) => !open && setEditing(null)}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-start gap-4 rounded-xl border border-tenant-ink/10 bg-white p-5 text-left shadow-sm transition-colors hover:border-tenant-accent hover:bg-tenant-gray"
        >
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-tenant-accent/10 text-tenant-accent">
            <CalendarRange className="h-5 w-5" />
          </div>
          <div>
            <p className="font-tenant-display text-base font-semibold text-tenant-ink">Reporting periods</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {periods.length
                ? `${periods.map((p) => periodMonthsLabel(p)).join(', ')} — and your time zone.`
                : 'Set the lead periods you report on (e.g. Jan–Feb, reported in March).'}
            </p>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-tenant-display text-tenant-ink">Reporting periods</DialogTitle>
          <DialogDescription>
            Leads received in a period are reported together in its report month.
            {!isAdmin && ' Only admins can change these.'}
          </DialogDescription>
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="space-y-2">
          {periods.length === 0 && editing !== 'new' && (
            <div className="rounded-lg border border-dashed border-tenant-ink/20 p-5 text-center">
              <p className="text-sm text-muted-foreground">No reporting periods yet.</p>
              {isAdmin && (
                <Button
                  type="button"
                  disabled={pending}
                  className="mt-3 bg-tenant-accent text-white hover:bg-tenant-accent/90"
                  onClick={() => run(addCommonReportingPeriods)}
                >
                  Start with common intakes (Jan–Feb, Apr–May, Sep–Oct)
                </Button>
              )}
            </div>
          )}

          {periods.map((p) =>
            editing === p.id ? (
              <PeriodForm key={p.id} period={p} onDone={() => setEditing(null)} />
            ) : (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-tenant-ink/10 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-tenant-ink">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Leads received {monthName(p.start_month)}
                    {p.end_month !== p.start_month && ` – ${monthName(p.end_month)}`} · reported in{' '}
                    {monthName(p.report_month)}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Edit"
                      onClick={() => setEditing(p.id)}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-tenant-gray hover:text-tenant-ink"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      disabled={pending}
                      onClick={() => {
                        if (confirm(`Delete “${p.name}”?`)) run(() => deleteReportingPeriod(p.id));
                      }}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ),
          )}

          {editing === 'new' && <PeriodForm onDone={() => setEditing(null)} />}

          {isAdmin && editing === null && (
            <button
              type="button"
              onClick={() => setEditing('new')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-tenant-accent hover:underline"
            >
              <Plus className="h-3.5 w-3.5" /> Add period
            </button>
          )}
          <p className="text-xs text-muted-foreground">
            Months outside every period still appear in the monthly report.
          </p>
        </div>

        <div className="border-t border-tenant-ink/10 pt-4">
          <TimezoneField timezone={timezone} isAdmin={isAdmin} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PeriodForm({ period, onDone }: { period?: ReportingPeriod; onDone: () => void }) {
  const router = useRouter();
  const action = saveReportingPeriod.bind(null, period?.id ?? null);
  const [state, formAction, pending] = useActionState(action, init);

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onDone();
    }
  }, [state, router, onDone]);

  const monthSelect = (name: string, label: string, value?: number) => (
    <div>
      <Label htmlFor={`period_${name}`}>{label}</Label>
      <Select id={`period_${name}`} name={name} defaultValue={value ?? ''} className="mt-1.5">
        <option value="" disabled>
          Month…
        </option>
        {MONTH_NAMES.map((m, i) => (
          <option key={m} value={i + 1}>
            {m}
          </option>
        ))}
      </Select>
      {state.fieldErrors?.[name] && <p className="mt-1 text-xs text-destructive">{state.fieldErrors[name]}</p>}
    </div>
  );

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-tenant-accent/30 bg-tenant-accent/5 p-4">
      <div>
        <Label htmlFor="period_name">Name</Label>
        <Input
          id="period_name"
          name="name"
          defaultValue={period?.name}
          placeholder="e.g. Sep–Oct intake"
          className="mt-1.5 bg-white"
          autoFocus
        />
        {state.fieldErrors?.name && <p className="mt-1 text-xs text-destructive">{state.fieldErrors.name}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {monthSelect('start_month', 'Leads from', period?.start_month)}
        {monthSelect('end_month', 'Leads to', period?.end_month)}
        {monthSelect('report_month', 'Report in', period?.report_month)}
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-3">
        <Button type="submit" disabled={pending} className="bg-tenant-accent text-white hover:bg-tenant-accent/90">
          {pending ? 'Saving…' : period ? 'Save period' : 'Add period'}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function TimezoneField({ timezone, isAdmin }: { timezone: string; isAdmin: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(timezone);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const zones = useMemo(() => {
    const all =
      typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [timezone];
    return all.includes(timezone) ? all : [timezone, ...all];
  }, [timezone]);

  return (
    <div>
      <Label htmlFor="reporting_timezone">Time zone</Label>
      <p className="text-xs text-muted-foreground">
        Decides when “today” and each month start for the dashboard and reports.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Select
          id="reporting_timezone"
          value={value}
          disabled={!isAdmin || pending}
          onChange={(e) => setValue(e.target.value)}
          className="w-[260px]"
        >
          {zones.map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
        {isAdmin && value !== timezone && (
          <Button
            type="button"
            disabled={pending}
            className="bg-tenant-accent text-white hover:bg-tenant-accent/90"
            onClick={() =>
              start(async () => {
                const res = await saveReportingTimezone(value);
                setMessage(res.ok ? { ok: true, text: 'Saved.' } : { ok: false, text: res.error ?? 'Could not save.' });
                router.refresh();
              })
            }
          >
            {pending ? 'Saving…' : 'Save'}
          </Button>
        )}
        {message && (
          <span className={message.ok ? 'text-sm text-emerald-600' : 'text-sm text-destructive'}>{message.text}</span>
        )}
      </div>
    </div>
  );
}
