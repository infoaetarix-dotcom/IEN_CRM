'use client';

import { useActionState, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { submitLead, type SubmitState } from './actions';
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

const initialState: SubmitState = { ok: false };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

// Tests that have a numeric score (Duolingo/IELTS/TOEFL/PTE); planned/none don't.
const SCORED_TESTS = ['ielts', 'toefl', 'pte', 'duolingo'];

export function LeadForm() {
  const params = useSearchParams();
  const [state, formAction, isPending] = useActionState(
    submitLead,
    initialState,
  );
  const [priorRejection, setPriorRejection] = useState(false);
  const [englishTest, setEnglishTest] = useState('');
  const [token, setToken] = useState('');

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
      <input type="hidden" name="utm_source" value={utm.source} />
      <input type="hidden" name="utm_medium" value={utm.medium} />
      <input type="hidden" name="utm_campaign" value={utm.campaign} />
      <input type="hidden" name="cf-turnstile-response" value={token} />

      {/* Honeypot */}
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

      {/* ============ ABOUT YOU ============ */}
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

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="date_of_birth">Date of birth *</Label>
            <DobField error={err.date_of_birth} />
          </div>
          <div>
            <Label htmlFor="city">City *</Label>
            <Input id="city" name="city" placeholder="e.g. Lahore" autoComplete="address-level2" required />
            <FieldError message={err.city} />
          </div>
          <div>
            <Label htmlFor="district">District</Label>
            <Input id="district" name="district" placeholder="e.g. Lahore" />
            <FieldError message={err.district} />
          </div>
        </div>
      </section>

      {/* ============ PRIOR EDUCATION & EXPERIENCE ============ */}
      <section className="space-y-4 rounded-lg border border-line bg-white p-6">
        <p className="label-eyebrow">Prior education &amp; experience</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="highest_education">Highest education level *</Label>
            <EducationField error={err.highest_education} />
          </div>
          <div>
            <Label htmlFor="last_qualification">Last qualification / field *</Label>
            <Input
              id="last_qualification"
              name="last_qualification"
              placeholder="e.g. BSc Computer Science"
              required
            />
            <FieldError message={err.last_qualification} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="prior_institution">Institution / board attended *</Label>
            <Input
              id="prior_institution"
              name="prior_institution"
              placeholder="Where you last studied"
              required
            />
            <FieldError message={err.prior_institution} />
          </div>
          <div>
            <Label htmlFor="passing_year">Passing year *</Label>
            <Select id="passing_year" name="passing_year" defaultValue="" required>
              <option value="">Select year</option>
              {PASSING_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <FieldError message={err.passing_year} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="grading_system">Grading system *</Label>
            <Select id="grading_system" name="grading_system" defaultValue="" required>
              <option value="">Select grading system</option>
              {GRADING_SYSTEMS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </Select>
            <FieldError message={err.grading_system} />
          </div>
          <div>
            <Label htmlFor="grade_value">Result (CGPA / %) *</Label>
            <Input
              id="grade_value"
              name="grade_value"
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              placeholder="e.g. 3.5 or 85"
              required
            />
            <FieldError message={err.grade_value} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="work_experience_years">Work experience (years)</Label>
            <Input
              id="work_experience_years"
              name="work_experience_years"
              type="number"
              min="0"
              max="60"
              inputMode="numeric"
              placeholder="0 if none"
            />
            <FieldError message={err.work_experience_years} />
          </div>
          <div>
            <Label htmlFor="work_experience_detail">Current / recent role</Label>
            <Input
              id="work_experience_detail"
              name="work_experience_detail"
              placeholder="e.g. Software Engineer at ABC (optional)"
            />
            <FieldError message={err.work_experience_detail} />
          </div>
        </div>
      </section>

      {/* ============ STUDY GOALS ============ */}
      <section className="space-y-4 rounded-lg border border-line bg-white p-6">
        <p className="label-eyebrow">Study goals</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="target_country">Target country *</Label>
            <CountryField error={err.target_country} />
          </div>
          <div>
            <Label htmlFor="institution">Preferred institution (abroad)</Label>
            <Input
              id="institution"
              name="institution"
              placeholder="University or college (optional)"
            />
            <FieldError message={err.institution} />
          </div>
        </div>

        <div>
          <Label htmlFor="program_degree">Program of interest</Label>
          <ProgramField error={err.program} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="intake_season">Intended intake</Label>
            <div className="grid grid-cols-2 gap-2">
              <Select id="intake_season" name="intake_season" defaultValue="">
                <option value="">Season</option>
                {INTAKE_SEASONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
              <Select name="intake_year" defaultValue="" aria-label="Intake year">
                <option value="">Year</option>
                {INTAKE_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
            <FieldError message={err.intake_season || err.intake_year} />
          </div>
          <div>
            <Label htmlFor="funding_source">How will you fund your studies?</Label>
            <Select id="funding_source" name="funding_source" defaultValue="">
              <option value="">Select funding source</option>
              {FUNDING_SOURCES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
            <FieldError message={err.funding_source} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="english_test">English proficiency test</Label>
            <Select
              id="english_test"
              name="english_test"
              value={englishTest}
              onChange={(e) => setEnglishTest(e.target.value)}
            >
              <option value="">Select test</option>
              {ENGLISH_TESTS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            <FieldError message={err.english_test} />
          </div>
          {SCORED_TESTS.includes(englishTest) && (
            <div>
              <Label htmlFor="english_score">Overall score</Label>
              <Input
                id="english_score"
                name="english_score"
                type="number"
                step="0.5"
                min="0"
                inputMode="decimal"
                placeholder="e.g. IELTS 6.5, TOEFL 90"
              />
              <FieldError message={err.english_score} />
            </div>
          )}
        </div>
      </section>

      {/* ============ VISA HISTORY ============ */}
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

      {/* ============ CONSENT ============ */}
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
