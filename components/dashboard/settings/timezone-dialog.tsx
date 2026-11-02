'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Globe } from 'lucide-react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { saveReportingTimezone } from '@/app/(admin)/settings/reporting-actions';

/**
 * Settings → Time zone tile. Decides when "today" and each month start for
 * the dashboard, reports and follow-up reminders. Everyone can see it;
 * only admins can change it.
 */
export function TimezoneDialog({ timezone, isAdmin }: { timezone: string; isAdmin: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(timezone);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const zones = useMemo(() => {
    const all = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [timezone];
    return all.includes(timezone) ? all : [timezone, ...all];
  }, [timezone]);

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) {
          setValue(timezone);
          setMessage(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <button
          type="button"
          className="flex w-full items-start gap-4 rounded-xl border border-tenant-ink/10 bg-white p-5 text-left shadow-sm transition-colors hover:border-tenant-accent hover:bg-tenant-gray"
        >
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-lg bg-tenant-accent/10 text-tenant-accent">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <p className="font-tenant-display text-base font-semibold text-tenant-ink">Time zone</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {timezone.replace(/_/g, ' ')} — used for “today”, reports and follow-up reminders.
            </p>
          </div>
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-tenant-display text-tenant-ink">Time zone</DialogTitle>
          <DialogDescription>
            Decides when “today” and each month start for the dashboard, reports and follow-up reminders.
            {!isAdmin && ' Only admins can change it.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="reporting_timezone">Time zone</Label>
            <Select
              id="reporting_timezone"
              value={value}
              disabled={!isAdmin || pending}
              onChange={(e) => setValue(e.target.value)}
              className="mt-1.5"
            >
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, ' ')}
                </option>
              ))}
            </Select>
          </div>
          {message && (
            <p className={message.ok ? 'text-sm text-emerald-600' : 'text-sm text-destructive'}>{message.text}</p>
          )}
          {isAdmin && (
            <Button
              type="button"
              disabled={pending || value === timezone}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
