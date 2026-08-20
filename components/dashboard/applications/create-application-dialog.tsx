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
import { UniversityPicker } from '@/components/dashboard/university-picker';
import { Button } from '@/components/ui/button';
import { ApplicationForm } from './application-form';
import type { ApplicationFormValues } from '@/lib/applications/types';
import type { University } from '@/lib/universities/types';
import { getLeadDefaultsForApplication } from '@/app/(admin)/applications/actions';

type Step = 'lead' | 'university' | 'form';

/**
 * "Create application" trigger + popup — used both on /applications (pick
 * any lead) and from a lead's own detail page (fixedLead already known, so
 * that step is skipped). Mirrors the "Create query" dialog on /leads.
 *
 * Three steps: pick the student (skipped when fixedLead is given) → pick the
 * university this application is for (required — see 0027_universities.sql)
 * → the full form, pre-filled from the lead and with that university
 * already selected but still changeable.
 */
export function CreateApplicationDialog({
  leads,
  universities,
  fixedLead,
  trigger,
}: {
  leads: { id: string; full_name: string }[];
  universities: University[];
  /** When set, the lead-picking step is skipped — used from a lead's own detail page. */
  fixedLead?: { id: string; full_name: string };
  /** Custom trigger element (e.g. a small icon button instead of the default "Create application" button). */
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>(fixedLead ? 'university' : 'lead');
  const [leadId, setLeadId] = useState(fixedLead?.id ?? '');
  const [universityId, setUniversityId] = useState('');
  const [values, setValues] = useState<ApplicationFormValues | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep(fixedLead ? 'university' : 'lead');
    setLeadId(fixedLead?.id ?? '');
    setUniversityId('');
    setValues(null);
    setError(null);
  }

  function handleContinueToUniversity() {
    setStep('university');
  }

  function handleContinueToForm() {
    setError(null);
    startTransition(async () => {
      const res = await getLeadDefaultsForApplication(leadId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setValues({ ...res.values, university_id: universityId });
      setStep('form');
    });
  }

  const description =
    step === 'lead'
      ? 'Choose which student this application belongs to.'
      : step === 'university'
        ? 'Which university is this application for?'
        : 'Pre-filled from the lead — review and add a passport number before saving.';

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <button className="inline-flex h-9 items-center gap-2 rounded-md bg-tenant-accent px-3 text-sm text-white hover:bg-tenant-accent/90">
            <Plus className="h-4 w-4" /> Create application
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-tenant-display text-tenant-ink">Create application</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {step === 'lead' && (
          <div className="space-y-4">
            <LeadPicker
              leads={leads}
              value={leadId}
              onChange={setLeadId}
              placeholder="Select a student…"
              allowClear={false}
            />
            <div className="flex gap-3">
              <Button
                disabled={!leadId}
                className="bg-tenant-accent text-white hover:bg-tenant-accent/90"
                onClick={handleContinueToUniversity}
              >
                Continue
              </Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {step === 'university' && (
          <div className="space-y-4">
            <UniversityPicker
              universities={universities}
              value={universityId}
              onChange={setUniversityId}
            />
            {universities.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No universities listed yet — add one in Settings first.
              </p>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3">
              <Button
                disabled={!universityId || pending}
                className="bg-tenant-accent text-white hover:bg-tenant-accent/90"
                onClick={handleContinueToForm}
              >
                {pending ? 'Loading…' : 'Continue'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => (fixedLead ? setOpen(false) : setStep('lead'))}
              >
                {fixedLead ? 'Cancel' : '← Back'}
              </Button>
            </div>
          </div>
        )}

        {step === 'form' && values && (
          <ApplicationForm
            leadId={leadId}
            initial={values}
            universities={universities}
            onCancel={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
