'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { LeadPicker } from '@/components/dashboard/lead-picker';
import { Button } from '@/components/ui/button';
import { ApplicationForm } from './application-form';
import type { ApplicationFormValues } from '@/lib/applications/types';
import { getLeadDefaultsForApplication } from '@/app/(admin)/applications/actions';

/**
 * "Create application" trigger + popup on /applications — mirrors the
 * "Create query" dialog on /leads. Two steps inside one dialog: pick the
 * lead this application belongs to, then fetch that lead's data to pre-fill
 * the same form used everywhere else for applications (see application-form.tsx).
 */
export function CreateApplicationDialog({
  leads,
}: {
  leads: { id: string; full_name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState('');
  const [values, setValues] = useState<ApplicationFormValues | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setLeadId('');
    setValues(null);
    setError(null);
  }

  function handleContinue() {
    setError(null);
    startTransition(async () => {
      const res = await getLeadDefaultsForApplication(leadId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setValues(res.values);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <button className="inline-flex h-9 items-center gap-2 rounded-md bg-tenant-accent px-3 text-sm text-white hover:bg-tenant-accent/90">
          <Plus className="h-4 w-4" /> Create application
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-tenant-display text-tenant-ink">Create application</DialogTitle>
          <DialogDescription>
            {values
              ? 'Pre-filled from the lead — review and add a passport number before saving.'
              : 'Choose which lead this application belongs to.'}
          </DialogDescription>
        </DialogHeader>

        {!values ? (
          <div className="space-y-4">
            <LeadPicker
              leads={leads}
              value={leadId}
              onChange={setLeadId}
              placeholder="Select a lead…"
              allowClear={false}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3">
              <Button
                disabled={!leadId || pending}
                className="bg-tenant-accent text-white hover:bg-tenant-accent/90"
                onClick={handleContinue}
              >
                {pending ? 'Loading…' : 'Continue'}
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <ApplicationForm leadId={leadId} initial={values} onCancel={() => setOpen(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
