'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
import { InlineAddUniversity } from '@/components/dashboard/inline-add-university';
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
 * already selected but still changeable. A university that isn't listed yet
 * can be added right in the university step (InlineAddUniversity).
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
  // null = picking from the list; a string = the inline add form is open,
  // pre-filled with whatever was typed in the picker's search.
  const [adding, setAdding] = useState<string | null>(null);
  // Added from this popup — shown immediately, before router.refresh() lands.
  const [addedUniversities, setAddedUniversities] = useState<University[]>([]);
  const router = useRouter();

  const allUniversities = useMemo(() => {
    const known = new Set(universities.map((u) => u.id));
    return [...universities, ...addedUniversities.filter((u) => !known.has(u.id))].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [universities, addedUniversities]);

  function reset() {
    setStep(fixedLead ? 'university' : 'lead');
    setLeadId(fixedLead?.id ?? '');
    setUniversityId('');
    setValues(null);
    setError(null);
    setAdding(null);
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
            {adding === null ? (
              <>
                <UniversityPicker
                  universities={allUniversities}
                  value={universityId}
                  onChange={setUniversityId}
                  onAddNew={(search) => setAdding(search)}
                />
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-tenant-accent hover:underline"
                  onClick={() => setAdding('')}
                >
                  <Plus className="h-3.5 w-3.5" /> University not listed? Add it here
                </button>
              </>
            ) : (
              <InlineAddUniversity
                defaultName={adding}
                onCancel={() => setAdding(null)}
                onCreated={(u) => {
                  setAddedUniversities((prev) => [...prev, u]);
                  setUniversityId(u.id);
                  setAdding(null);
                  // Pull the new university into the page's own data too, so
                  // it's there next time without a manual reload.
                  router.refresh();
                }}
              />
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {adding === null && (
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
            )}
          </div>
        )}

        {step === 'form' && values && (
          <ApplicationForm
            leadId={leadId}
            initial={values}
            universities={allUniversities}
            onCancel={() => setOpen(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
