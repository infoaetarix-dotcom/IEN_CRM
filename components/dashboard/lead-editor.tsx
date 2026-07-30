'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { updateLead } from '@/app/(admin)/leads/actions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  EDUCATION_OPTIONS,
  DEGREE_OPTIONS,
  GRADING_SYSTEMS,
  ENGLISH_TESTS,
  INTAKE_SEASONS,
  FUNDING_SOURCES,
  PASSING_YEARS,
  INTAKE_YEARS,
} from '@/lib/form-options';
import { TARGET_COUNTRIES } from '@/lib/validation/lead';

/** Applicant-editable fields, all held as form strings (numbers coerce server-side). */
export interface LeadEditState {
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  city: string;
  district: string;
  target_country: string;
  institution: string;
  program: string;
  intake_season: string;
  intake_year: string;
  highest_education: string;
  last_qualification: string;
  prior_institution: string;
  passing_year: string;
  grading_system: string;
  grade_value: string;
  work_experience_years: string;
  work_experience_detail: string;
  english_test: string;
  english_score: string;
  funding_source: string;
  prior_rejection: boolean;
  prior_rejection_detail: string;
}

/** Show the current stored value even if it isn't one of the preset options. */
function withCurrent(options: readonly string[], current: string): string[] {
  return current && !options.includes(current) ? [current, ...options] : [...options];
}

function LField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="label-eyebrow">{label}</Label>
      {children}
    </div>
  );
}

/**
 * Inline editor for a lead's applicant-provided fields. Renders the read-only
 * detail cards (passed as children) until the user clicks Edit, then swaps in a
 * grouped form. Save goes through the RLS-gated `updateLead` action, so only an
 * admin or the assigned agent can persist changes.
 */
export function LeadDetailsEditor({
  leadId,
  canEdit,
  initial,
  children,
}: {
  leadId: string;
  canEdit: boolean;
  initial: LeadEditState;
  children: ReactNode;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<LeadEditState>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof LeadEditState>(k: K, v: LeadEditState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function cancel() {
    setForm(initial);
    setError(null);
    setEditing(false);
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await updateLead(leadId, form);
      if (!res.ok) {
        setError(res.error ?? 'Could not save changes.');
      } else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  if (!editing) {
    return (
      <div className="space-y-6">
        {canEdit && (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Edit details
            </Button>
          </div>
        )}
        {children}
      </div>
    );
  }

  const text = (k: keyof LeadEditState, type = 'text') => (
    <Input
      type={type}
      value={form[k] as string}
      disabled={pending}
      onChange={(e) => set(k, e.target.value as never)}
    />
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Editing applicant details</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={cancel} disabled={pending}>
            Cancel
          </Button>
          <Button size="sm" variant="accent" onClick={save} disabled={pending}>
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Contact & location */}
      <Card>
        <CardHeader>
          <CardTitle>Contact &amp; location</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <LField label="Full name">{text('full_name')}</LField>
          <LField label="Email">{text('email', 'email')}</LField>
          <LField label="Phone">{text('phone', 'tel')}</LField>
          <LField label="Date of birth">{text('date_of_birth', 'date')}</LField>
          <LField label="City">{text('city')}</LField>
          <LField label="District">{text('district')}</LField>
        </CardContent>
      </Card>

      {/* Prior education & experience */}
      <Card>
        <CardHeader>
          <CardTitle>Prior education &amp; experience</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <LField label="Highest education">
            <Select
              value={form.highest_education}
              disabled={pending}
              onChange={(e) => set('highest_education', e.target.value)}
            >
              <option value="">Select…</option>
              {withCurrent(EDUCATION_OPTIONS, form.highest_education).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </Select>
          </LField>
          <LField label="Qualification">
            <Select
              value={form.last_qualification}
              disabled={pending}
              onChange={(e) => set('last_qualification', e.target.value)}
            >
              <option value="">Select…</option>
              {withCurrent(DEGREE_OPTIONS, form.last_qualification).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </Select>
          </LField>
          <LField label="Institution attended">{text('prior_institution')}</LField>
          <LField label="Passing year">
            <Select
              value={form.passing_year}
              disabled={pending}
              onChange={(e) => set('passing_year', e.target.value)}
            >
              <option value="">Select…</option>
              {PASSING_YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </LField>
          <LField label="Grading system">
            <Select
              value={form.grading_system}
              disabled={pending}
              onChange={(e) => set('grading_system', e.target.value)}
            >
              <option value="">Select…</option>
              {GRADING_SYSTEMS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </Select>
          </LField>
          <LField label="Result">{text('grade_value', 'number')}</LField>
          <LField label="Work experience (years)">
            {text('work_experience_years', 'number')}
          </LField>
          <LField label="Work experience detail">
            {text('work_experience_detail')}
          </LField>
        </CardContent>
      </Card>

      {/* Study goals */}
      <Card>
        <CardHeader>
          <CardTitle>Study goals</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <LField label="Target country">
            <Select
              value={form.target_country}
              disabled={pending}
              onChange={(e) => set('target_country', e.target.value)}
            >
              <option value="">Select…</option>
              {withCurrent(TARGET_COUNTRIES, form.target_country).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </LField>
          <LField label="Preferred institution">{text('institution')}</LField>
          <LField label="Program">{text('program')}</LField>
          <LField label="Intake season">
            <Select
              value={form.intake_season}
              disabled={pending}
              onChange={(e) => set('intake_season', e.target.value)}
            >
              <option value="">Select…</option>
              {INTAKE_SEASONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </LField>
          <LField label="Intake year">
            <Select
              value={form.intake_year}
              disabled={pending}
              onChange={(e) => set('intake_year', e.target.value)}
            >
              <option value="">Select…</option>
              {INTAKE_YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </LField>
          <LField label="English test">
            <Select
              value={form.english_test}
              disabled={pending}
              onChange={(e) => set('english_test', e.target.value)}
            >
              <option value="">Select…</option>
              {ENGLISH_TESTS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </LField>
          <LField label="English score">{text('english_score', 'number')}</LField>
          <LField label="Funding source">
            <Select
              value={form.funding_source}
              disabled={pending}
              onChange={(e) => set('funding_source', e.target.value)}
            >
              <option value="">Select…</option>
              {FUNDING_SOURCES.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </Select>
          </LField>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <Checkbox
              checked={form.prior_rejection}
              disabled={pending}
              onChange={(e) => set('prior_rejection', e.target.checked)}
            />
            Prior visa rejection
          </label>
          {form.prior_rejection && (
            <LField label="Rejection detail">
              <Textarea
                rows={2}
                value={form.prior_rejection_detail}
                disabled={pending}
                onChange={(e) => set('prior_rejection_detail', e.target.value)}
              />
            </LField>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
