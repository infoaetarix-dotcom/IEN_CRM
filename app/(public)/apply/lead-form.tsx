'use client';

import { useActionState, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { submitLead, type SubmitState } from './actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Turnstile } from '@/components/form/turnstile';
import { EmailField } from '@/components/form/email-field';
import { PhoneField } from '@/components/form/phone-field';
import { DobField } from '@/components/form/dob-field';
import { CountryField } from '@/components/form/country-field';
import { EducationField } from '@/components/form/education-field';
import { ProgramField } from '@/components/form/program-field';

const initialState: SubmitState = { ok: false };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

export function LeadForm() {
  const params = useSearchParams();
  const [state, formAction, isPending] = useActionState(
    submitLead,
    initialState,
  );
  const [priorRejection, setPriorRejection] = useState(false);
  const [token, setToken] = useState('');

  // Capture UTM once on load; persist so client navigation doesn't drop them.
  const [utm, setUtm] = useState({ source: '', medium: '', campaign: '' });
  useEffect(() => {
    setUtm({
      source: params.get('utm_source') ?? '',
      medium: params.get('utm_medium') ?? '',
      campaign: params.get('utm_campaign') ?? '',
    });
  }, [params]);

  const err = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {/* Hidden: UTM + Turnstile token */}
      <input type="hidden" name="utm_source" value={utm.source} />
      <input type="hidden" name="utm_medium" value={utm.medium} />
      <input type="hidden" name="utm_campaign" value={utm.campaign} />
      <input type="hidden" name="cf-turnstile-response" value={token} />

      {/* Honeypot — visually hidden, off-screen, not announced. Bots fill it. */}
      <div aria-hidden className="absolute left-[-9999px] top-[-9999px]">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <section className="space-y-4 rounded-lg border border-line bg-white p-6">
        <p className="label-eyebrow">About you</p>

        <div>
          <Label htmlFor="full_name">Full name *</Label>
          <Input id="full_name" name="full_name" autoComplete="name" required />
          <FieldError message={err.full_name} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="email">Email *</Label>
            <EmailField error={err.email} />
          </div>
          <div>
            <Label htmlFor="phone">Phone *</Label>
            <PhoneField error={err.phone} />
          </div>
        </div>

        <div className="sm:max-w-[60%]">
          <Label htmlFor="date_of_birth">Date of birth *</Label>
          <DobField error={err.date_of_birth} />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-line bg-white p-6">
        <p className="label-eyebrow">Study goals</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="target_country">Target country</Label>
            <CountryField error={err.target_country} />
          </div>
          <div>
            <Label htmlFor="highest_education">Highest education</Label>
            <EducationField error={err.highest_education} />
          </div>
        </div>

        <div>
          <Label htmlFor="institution">Preferred institution</Label>
          <Input
            id="institution"
            name="institution"
            placeholder="University or college (optional)"
          />
          <FieldError message={err.institution} />
        </div>

        <div>
          <Label htmlFor="program_degree">Program of interest</Label>
          <ProgramField error={err.program} />
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-line bg-white p-6">
        <p className="label-eyebrow">Visa history</p>

        <label className="flex items-center gap-3 text-sm">
          <Checkbox
            name="prior_rejection"
            checked={priorRejection}
            onChange={(e) => setPriorRejection(e.target.checked)}
          />
          I have had a prior visa rejection
        </label>

        {priorRejection && (
          <div>
            <Label htmlFor="prior_rejection_detail">
              Briefly, what happened?
            </Label>
            <Textarea
              id="prior_rejection_detail"
              name="prior_rejection_detail"
              rows={3}
              placeholder="Country, year, and reason if known."
            />
            <FieldError message={err.prior_rejection_detail} />
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-lg border border-line bg-white p-6">
        <label className="flex items-start gap-3 text-sm">
          <Checkbox name="consent_given" required className="mt-0.5" />
          <span>
            I consent to IEN Visa Consultancy storing and processing the details
            above to contact me about my application. *
          </span>
        </label>
        <FieldError message={err.consent_given} />

        <Turnstile onVerify={setToken} />
      </section>

      <Button
        type="submit"
        variant="accent"
        size="lg"
        disabled={isPending}
        className="w-full sm:w-auto"
      >
        {isPending ? 'Submitting…' : 'Submit application'}
      </Button>
    </form>
  );
}
