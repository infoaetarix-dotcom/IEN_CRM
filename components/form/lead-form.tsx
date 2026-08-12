'use client';

import { useActionState, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import {
  startLead,
  saveStep2,
  completeLead,
  type StepState,
} from '@/app/(public)/apply/actions';
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
import { cn } from '@/lib/utils';
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

type StepAction = (prev: StepState, formData: FormData) => Promise<StepState>;

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-xs text-destructive">{message}</p>;
}

/** Marks a required field — paired with `Optional` so every label states its status. */
function Required() {
  return (
    <span className="ml-0.5 text-destructive" aria-hidden>
      *
    </span>
  );
}

function Optional() {
  return (
    <span className="ml-1.5 text-xs font-normal normal-case tracking-normal text-muted-foreground">
      (optional)
    </span>
  );
}

/** Numbered progress stepper — circles fill in as steps complete, labels hide on narrow screens. */
function Stepper({ step, labels }: { step: number; labels: string[] }) {
  return (
    <div className="mb-7 sm:mb-8">
      <ol className="flex items-start">
        {labels.map((label, i) => {
          const idx = i + 1;
          const complete = idx < step;
          const current = idx === step;
          return (
            <li key={label} className="flex flex-1 items-start last:flex-none">
              <div className="flex flex-col items-center gap-1.5 text-center">
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors',
                    complete && 'border-tenant-accent bg-tenant-accent text-white',
                    current && 'border-tenant-accent bg-white text-tenant-accent',
                    !complete && !current && 'border-line bg-white text-muted-foreground',
                  )}
                >
                  {complete ? <Check className="h-4 w-4" /> : idx}
                </span>
                <span
                  className={cn(
                    'hidden max-w-[6rem] text-[11px] font-medium leading-tight sm:block',
                    current ? 'text-tenant-ink' : 'text-muted-foreground',
                  )}
                >
                  {label}
                </span>
              </div>
              {idx < labels.length && (
                <span
                  aria-hidden
                  className={cn(
                    'mx-2 mt-4 h-0.5 flex-1 rounded-full transition-colors',
                    complete ? 'bg-tenant-accent' : 'bg-line',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-center text-xs text-muted-foreground sm:hidden">
        Step {step} of {labels.length} · {labels[step - 1]}
      </p>
    </div>
  );
}

/** Section title + helper line, shared across all three steps for a consistent rhythm. */
function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5 border-b border-line/70 pb-4">
      <h2 className="font-tenant-display text-lg font-semibold text-tenant-ink sm:text-xl">
        {title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function LeadForm({
  /** Consultancy named in the consent line — never hardcode one client here. */
  consentName = 'this consultancy',
  /** Which org this submission belongs to — read from the /{slug}/apply route
   *  and passed through as a hidden field so startLead knows who owns the
   *  lead. The staff "Create Query" flow doesn't set this: its own
   *  session-scoped action infers the org from the signed-in user instead. */
  orgSlug,
  /** Defaults to the public apply-wizard actions; the staff "Create Query"
   *  dialog on /leads passes its own session-scoped versions. */
  actions = { step1: startLead, step2: saveStep2, step3: completeLead },
  /** Public flow completes via a server-side redirect to /thank-you, so this
   *  never fires there. The staff flow's step 3 returns normally instead of
   *  redirecting (it's rendered inside the CRM, not a standalone page), and
   *  uses this to navigate to the new lead once it's done. */
  onComplete,
  /** Staff are already authenticated — skip the bot-verification widget. */
  showTurnstile = true,
}: {
  consentName?: string;
  orgSlug?: string;
  actions?: { step1: StepAction; step2: StepAction; step3: StepAction };
  onComplete?: (leadId: string) => void;
  showTurnstile?: boolean;
}) {
  const params = useSearchParams();
  const [step, setStep] = useState(1);
  const [lead, setLead] = useState({ id: '', token: '' });
  const [priorRejection, setPriorRejection] = useState(false);
  const [englishTest, setEnglishTest] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');

  const [s1, action1, p1] = useActionState(actions.step1, init);
  const [s2, action2, p2] = useActionState(actions.step2, init);
  const [s3, action3, p3] = useActionState(actions.step3, init);

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
  useEffect(() => {
    if (s3.ok && lead.id) onComplete?.(lead.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s3]);

  const err1 = s1.fieldErrors ?? {};
  const err2 = s2.fieldErrors ?? {};
  const err3 = s3.fieldErrors ?? {};
  const stepError = [s1, s2, s3][step - 1]?.error;

  return (
    <div>
      <Stepper step={step} labels={STEP_LABELS} />

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
        {orgSlug && <input type="hidden" name="org_slug" value={orgSlug} />}
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
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{stepError}</span>
          </div>
        )}

        {/* ================= STEP 1 ================= */}
        <div className={step === 1 ? 'space-y-6' : 'hidden'}>
          <section className="space-y-4 rounded-xl border border-tenant-ink/10 bg-white p-5 shadow-sm sm:p-8">
            <StepHeading
              title="Let’s get started"
              description="Just the basics — this takes about 30 seconds."
            />
            <div>
              <Label htmlFor="full_name">
                Full name
                <Required />
              </Label>
              <Input
                id="full_name"
                name="full_name"
                placeholder="e.g. Ayesha Khan"
                autoComplete="name"
                className="mt-1.5"
              />
              <FieldError message={err1.full_name} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="email">
                  Email address
                  <Required />
                </Label>
                <div className="mt-1.5">
                  <EmailField error={err1.email} />
                </div>
              </div>
              <div>
                <Label htmlFor="phone">
                  Phone number
                  <Required />
                </Label>
                <div className="mt-1.5">
                  <PhoneField error={err1.phone} />
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="target_country">
                Select preferred country for study
                <Required />
              </Label>
              <div className="mt-1.5">
                <CountryField error={err1.target_country} />
              </div>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <Checkbox name="consent_given" className="mt-0.5 text-tenant-accent accent-tenant-accent" />
              <span>
                I consent to {consentName} storing and processing these details
                to contact me about my application.
                <Required />
              </span>
            </label>
            <FieldError message={err1.consent_given} />
            {showTurnstile && <Turnstile onVerify={setTurnstileToken} />}
          </section>

          <Button
            type="submit"
            formAction={action1}
            variant="accent"
            size="lg"
            disabled={p1}
            className="w-full bg-tenant-accent hover:bg-tenant-accent/90 sm:w-auto"
          >
            {p1 ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Saving…
              </>
            ) : (
              <>
                Continue <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>

        {/* ================= STEP 2 ================= */}
        <div className={step === 2 ? 'space-y-6' : 'hidden'}>
          <section className="space-y-4 rounded-xl border border-tenant-ink/10 bg-white p-5 shadow-sm sm:p-8">
            <StepHeading
              title="Your background"
              description="Your education history helps us match you with the right programs."
            />
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              <div>
                <Label htmlFor="date_of_birth">
                  Date of birth
                  <Required />
                </Label>
                <div className="mt-1.5">
                  <DobField error={err2.date_of_birth} />
                </div>
              </div>
              <div>
                <Label htmlFor="city">
                  City
                  <Required />
                </Label>
                <Input id="city" name="city" placeholder="e.g. Lahore" autoComplete="address-level2" className="mt-1.5" />
                <FieldError message={err2.city} />
              </div>
              <div>
                <Label htmlFor="district">
                  District
                  <Optional />
                </Label>
                <Input id="district" name="district" placeholder="e.g. Model Town" className="mt-1.5" />
                <FieldError message={err2.district} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="highest_education">
                  Highest education level
                  <Required />
                </Label>
                <div className="mt-1.5">
                  <EducationField error={err2.highest_education} />
                </div>
              </div>
              <div>
                <Label htmlFor="last_qualification">
                  Qualification obtained
                  <Required />
                </Label>
                <Input
                  id="last_qualification"
                  name="last_qualification"
                  placeholder="e.g. BSc Computer Science"
                  className="mt-1.5"
                />
                <FieldError message={err2.last_qualification} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="prior_institution">
                  School / institution attended
                  <Required />
                </Label>
                <Input
                  id="prior_institution"
                  name="prior_institution"
                  placeholder="e.g. Punjab University"
                  className="mt-1.5"
                />
                <FieldError message={err2.prior_institution} />
              </div>
              <div>
                <Label htmlFor="passing_year">
                  Year completed
                  <Required />
                </Label>
                <div className="mt-1.5">
                  <Select id="passing_year" name="passing_year" defaultValue="">
                    <option value="">Select year</option>
                    {PASSING_YEARS.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </Select>
                </div>
                <FieldError message={err2.passing_year} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="grading_system">
                  Grading system
                  <Required />
                </Label>
                <div className="mt-1.5">
                  <Select id="grading_system" name="grading_system" defaultValue="">
                    <option value="">Select grading system</option>
                    {GRADING_SYSTEMS.map((x) => (
                      <option key={x.value} value={x.value}>{x.label}</option>
                    ))}
                  </Select>
                </div>
                <FieldError message={err2.grading_system} />
              </div>
              <div>
                <Label htmlFor="grade_value">
                  Your result
                  <Required />
                </Label>
                <Input
                  id="grade_value"
                  name="grade_value"
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  placeholder="e.g. 3.5 or 85"
                  className="mt-1.5"
                />
                <FieldError message={err2.grade_value} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="work_experience_years">
                  Years of experience
                  <Optional />
                </Label>
                <Input
                  id="work_experience_years"
                  name="work_experience_years"
                  type="number"
                  min="0"
                  max="60"
                  inputMode="numeric"
                  placeholder="0 if none"
                  className="mt-1.5"
                />
                <FieldError message={err2.work_experience_years} />
              </div>
              <div>
                <Label htmlFor="work_experience_detail">
                  Current role
                  <Optional />
                </Label>
                <Input
                  id="work_experience_detail"
                  name="work_experience_detail"
                  placeholder="e.g. Software Engineer"
                  className="mt-1.5"
                />
              </div>
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button type="button" variant="outline" size="lg" onClick={() => setStep(1)} className="w-full sm:w-auto">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              type="submit"
              formAction={action2}
              variant="accent"
              size="lg"
              disabled={p2}
              className="w-full bg-tenant-accent hover:bg-tenant-accent/90 sm:flex-1"
            >
              {p2 ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                </>
              ) : (
                <>
                  Continue <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* ================= STEP 3 ================= */}
        <div className={step === 3 ? 'space-y-6' : 'hidden'}>
          <section className="space-y-4 rounded-xl border border-tenant-ink/10 bg-white p-5 shadow-sm sm:p-8">
            <StepHeading
              title="Your goals"
              description="Almost done — these help us tailor your options. All optional."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="institution">
                  Preferred university
                  <Optional />
                </Label>
                <Input
                  id="institution"
                  name="institution"
                  placeholder="e.g. University of Toronto"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="funding_source">
                  How will you fund your studies?
                  <Optional />
                </Label>
                <div className="mt-1.5">
                  <Select id="funding_source" name="funding_source" defaultValue="">
                    <option value="">Select funding source</option>
                    {FUNDING_SOURCES.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="program_degree">
                Program of interest
                <Optional />
              </Label>
              <div className="mt-1.5">
                <ProgramField error={err3.program} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="intake_season">
                  Preferred intake
                  <Optional />
                </Label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
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
                <Label htmlFor="english_test">
                  English proficiency test
                  <Optional />
                </Label>
                <div className="mt-1.5">
                  <Select id="english_test" name="english_test" value={englishTest} onChange={(e) => setEnglishTest(e.target.value)}>
                    <option value="">Select test</option>
                    {ENGLISH_TESTS.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
            {SCORED_TESTS.includes(englishTest) && (
              <div className="sm:max-w-[50%]">
                <Label htmlFor="english_score">
                  Overall score
                  <Optional />
                </Label>
                <Input
                  id="english_score"
                  name="english_score"
                  type="number"
                  step="0.5"
                  min="0"
                  inputMode="decimal"
                  placeholder="e.g. 6.5 (IELTS), 90 (TOEFL)"
                  className="mt-1.5"
                />
                <FieldError message={err3.english_score} />
              </div>
            )}
            <label className="flex items-center gap-3 text-sm">
              <Checkbox name="prior_rejection" checked={priorRejection} onChange={(e) => setPriorRejection(e.target.checked)} className="text-tenant-accent accent-tenant-accent" />
              I have had a prior visa rejection
            </label>
            {priorRejection && (
              <div>
                <Label htmlFor="prior_rejection_detail">
                  Briefly, what happened?
                  <Required />
                </Label>
                <Textarea
                  id="prior_rejection_detail"
                  name="prior_rejection_detail"
                  rows={3}
                  placeholder="e.g. UK student visa, 2023 — refused for insufficient funds evidence"
                  className="mt-1.5"
                />
                <FieldError message={err3.prior_rejection_detail} />
              </div>
            )}
          </section>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button type="button" variant="outline" size="lg" onClick={() => setStep(2)} className="w-full sm:w-auto">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              type="submit"
              formAction={action3}
              variant="accent"
              size="lg"
              disabled={p3}
              className="w-full bg-tenant-accent hover:bg-tenant-accent/90 sm:flex-1"
            >
              {p3 ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Submitting…
                </>
              ) : (
                <>
                  Submit application <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
