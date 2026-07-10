'use client';

import { useActionState, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  startLead,
  saveStep2,
  completeLead,
  type StepState,
} from './actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
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
import {
  GRADING_SYSTEMS,
  ENGLISH_TESTS,
  INTAKE_SEASONS,
  FUNDING_SOURCES,
  PASSING_YEARS,
  INTAKE_YEARS,
} from '@/lib/form-options';

const init: StepState = { ok: false };
const SCORED_TESTS = ['ielts', 'toefl', 'pte', 'duolingo'];
const STEP_LABELS = ['Let’s start', 'Your background', 'Your goals'];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

export function LeadForm() {
  const params = useSearchParams();
  const [step, setStep] = useState(1);
  const [lead, setLead] = useState({ id: '', token: '' });
  const [priorRejection, setPriorRejection] = useState(false);
  const [englishTest, setEnglishTest] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');

  const [s1, action1, p1] = useActionState(startLead, init);
  const [s2, action2, p2] = useActionState(saveStep2, init);
  const [s3, action3, p3] = useActionState(completeLead, init);

  const [utm, setUtm] = useState({ source: '', medium: '', campaign: '' });
  useEffect(() => {
    setUtm({
      source: params.get('utm_source') ?? '',
      medium: params.get('utm_medium') ?? '',
      campaign: params.get('utm_campaign') ?? '',
    });
  }, [params]);

  // Advance on each successful step; capture the lead id + token from step 1.
  useEffect(() => {
    if (s1.ok && s1.leadId) {
      setLead({ id: s1.leadId, token: s1.submissionToken ?? '' });
      setStep((s) => (s < 2 ? 2 : s));
    }
  }, [s1]);
  useEffect(() => {
    if (s2.ok) setStep((s) => (s < 3 ? 3 : s));
  }, [s2]);

  const err1 = s1.fieldErrors ?? {};
  const err2 = s2.fieldErrors ?? {};
  const err3 = s3.fieldErrors ?? {};
  const stepError = [s1, s2, s3][step - 1]?.error;

  return (
    <div>
      {/* Progress */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium">
            Step {step} of 3 · {STEP_LABELS[step - 1]}
          </p>
          <p className="text-xs text-muted-foreground">
            {Math.round((step / 3) * 100)}%
          </p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent transition-all duration-300"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      <form
        className="space-y-6"
        noValidate
        onKeyDown={(e) => {
          // Prevent Enter from submitting mid-wizard (except in textareas).
          const el = e.target as HTMLElement;
          if (e.key === 'Enter' && el.tagName !== 'TEXTAREA') e.preventDefault();
        }}
      >
        {/* Hidden: identity of the in-progress lead + UTM + Turnstile + honeypot */}
        <input type="hidden" name="lead_id" value={lead.id} />
        <input type="hidden" name="submission_token" value={lead.token} />
        <input type="hidden" name="utm_source" value={utm.source} />
        <input type="hidden" name="utm_medium" value={utm.medium} />
        <input type="hidden" name="utm_campaign" value={utm.campaign} />
        <input type="hidden" name="cf-turnstile-response" value={turnstileToken} />
        <div aria-hidden className="absolute left-[-9999px] top-[-9999px]">
          <label>
            Company
            <input type="text" name="company" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        {stepError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {stepError}
          </div>
        )}

        {/* ================= STEP 1 ================= */}
        <div className={step === 1 ? 'space-y-6' : 'hidden'}>
          <section className="space-y-4 rounded-lg border border-line bg-white p-6">
            <p className="label-eyebrow">Let’s start — it takes 30 seconds</p>
            <div>
              <Label htmlFor="full_name">Full name *</Label>
              <Input id="full_name" name="full_name" autoComplete="name" />
              <FieldError message={err1.full_name} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="email">Email *</Label>
                <EmailField error={err1.email} />
              </div>
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <PhoneField error={err1.phone} />
              </div>
            </div>
            <div>
              <Label htmlFor="target_country">Which country do you want to study in? *</Label>
              <CountryField error={err1.target_country} />
            </div>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox name="consent_given" className="mt-0.5" />
              <span>
                I consent to IEN Visa Consultancy storing and processing these
                details to contact me about my application. *
              </span>
            </label>
            <FieldError message={err1.consent_given} />
            <Turnstile onVerify={setTurnstileToken} />
          </section>

          <Button
            type="submit"
            formAction={action1}
            variant="accent"
            size="lg"
            disabled={p1}
            className="w-full sm:w-auto"
          >
            {p1 ? 'Saving…' : 'Continue →'}
          </Button>
        </div>

        {/* ================= STEP 2 ================= */}
        <div className={step === 2 ? 'space-y-6' : 'hidden'}>
          <section className="space-y-4 rounded-lg border border-line bg-white p-6">
            <p className="label-eyebrow">Your background</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="date_of_birth">Date of birth *</Label>
                <DobField error={err2.date_of_birth} />
              </div>
              <div>
                <Label htmlFor="city">City *</Label>
                <Input id="city" name="city" placeholder="e.g. Lahore" autoComplete="address-level2" />
                <FieldError message={err2.city} />
              </div>
              <div>
                <Label htmlFor="district">District</Label>
                <Input id="district" name="district" placeholder="e.g. Lahore" />
                <FieldError message={err2.district} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="highest_education">Highest education level *</Label>
                <EducationField error={err2.highest_education} />
              </div>
              <div>
                <Label htmlFor="last_qualification">Last qualification / field *</Label>
                <Input id="last_qualification" name="last_qualification" placeholder="e.g. BSc Computer Science" />
                <FieldError message={err2.last_qualification} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="prior_institution">Institution / board attended *</Label>
                <Input id="prior_institution" name="prior_institution" placeholder="Where you last studied" />
                <FieldError message={err2.prior_institution} />
              </div>
              <div>
                <Label htmlFor="passing_year">Passing year *</Label>
                <Select id="passing_year" name="passing_year" defaultValue="">
                  <option value="">Select year</option>
                  {PASSING_YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </Select>
                <FieldError message={err2.passing_year} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="grading_system">Grading system *</Label>
                <Select id="grading_system" name="grading_system" defaultValue="">
                  <option value="">Select grading system</option>
                  {GRADING_SYSTEMS.map((x) => (
                    <option key={x.value} value={x.value}>{x.label}</option>
                  ))}
                </Select>
                <FieldError message={err2.grading_system} />
              </div>
              <div>
                <Label htmlFor="grade_value">Result (CGPA / %) *</Label>
                <Input id="grade_value" name="grade_value" type="number" step="0.01" min="0" inputMode="decimal" placeholder="e.g. 3.5 or 85" />
                <FieldError message={err2.grade_value} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="work_experience_years">Work experience (years)</Label>
                <Input id="work_experience_years" name="work_experience_years" type="number" min="0" max="60" inputMode="numeric" placeholder="0 if none" />
                <FieldError message={err2.work_experience_years} />
              </div>
              <div>
                <Label htmlFor="work_experience_detail">Current / recent role</Label>
                <Input id="work_experience_detail" name="work_experience_detail" placeholder="e.g. Software Engineer (optional)" />
              </div>
            </div>
          </section>

          <div className="flex gap-3">
            <Button type="button" variant="outline" size="lg" onClick={() => setStep(1)}>
              ← Back
            </Button>
            <Button type="submit" formAction={action2} variant="accent" size="lg" disabled={p2} className="flex-1 sm:flex-none">
              {p2 ? 'Saving…' : 'Continue →'}
            </Button>
          </div>
        </div>

        {/* ================= STEP 3 ================= */}
        <div className={step === 3 ? 'space-y-6' : 'hidden'}>
          <section className="space-y-4 rounded-lg border border-line bg-white p-6">
            <p className="label-eyebrow">Your goals — almost done</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="institution">Preferred institution (abroad)</Label>
                <Input id="institution" name="institution" placeholder="University or college (optional)" />
              </div>
              <div>
                <Label htmlFor="funding_source">How will you fund your studies?</Label>
                <Select id="funding_source" name="funding_source" defaultValue="">
                  <option value="">Select funding source</option>
                  {FUNDING_SOURCES.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="program_degree">Program of interest</Label>
              <ProgramField error={err3.program} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="intake_season">Intended intake</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Select id="intake_season" name="intake_season" defaultValue="">
                    <option value="">Season</option>
                    {INTAKE_SEASONS.map((x) => (
                      <option key={x.value} value={x.value}>{x.label}</option>
                    ))}
                  </Select>
                  <Select name="intake_year" defaultValue="" aria-label="Intake year">
                    <option value="">Year</option>
                    {INTAKE_YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="english_test">English proficiency test</Label>
                <Select id="english_test" name="english_test" value={englishTest} onChange={(e) => setEnglishTest(e.target.value)}>
                  <option value="">Select test</option>
                  {ENGLISH_TESTS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </Select>
              </div>
            </div>
            {SCORED_TESTS.includes(englishTest) && (
              <div className="sm:max-w-[50%]">
                <Label htmlFor="english_score">Overall score</Label>
                <Input id="english_score" name="english_score" type="number" step="0.5" min="0" inputMode="decimal" placeholder="e.g. IELTS 6.5, TOEFL 90" />
                <FieldError message={err3.english_score} />
              </div>
            )}
            <label className="flex items-center gap-3 text-sm">
              <Checkbox name="prior_rejection" checked={priorRejection} onChange={(e) => setPriorRejection(e.target.checked)} />
              I have had a prior visa rejection
            </label>
            {priorRejection && (
              <div>
                <Label htmlFor="prior_rejection_detail">Briefly, what happened?</Label>
                <Textarea id="prior_rejection_detail" name="prior_rejection_detail" rows={3} placeholder="Country, year, and reason if known." />
                <FieldError message={err3.prior_rejection_detail} />
              </div>
            )}
          </section>

          <div className="flex gap-3">
            <Button type="button" variant="outline" size="lg" onClick={() => setStep(2)}>
              ← Back
            </Button>
            <Button type="submit" formAction={action3} variant="accent" size="lg" disabled={p3} className="flex-1 sm:flex-none">
              {p3 ? 'Submitting…' : 'Submit application'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
