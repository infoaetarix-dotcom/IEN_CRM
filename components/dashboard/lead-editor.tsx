'use client';

import {
  useState,
  useRef,
  useTransition,
  useId,
  cloneElement,
  type ReactNode,
  type ReactElement,
} from 'react';
import { useRouter } from 'next/navigation';
import { updateLead } from '@/app/(admin)/leads/actions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  EDUCATION_OPTIONS,
  GRADING_SYSTEMS,
  ENGLISH_TESTS,
  INTAKE_SEASONS,
  FUNDING_SOURCES,
  PASSING_YEARS,
  INTAKE_YEARS,
  CODE_LABELS,
  gradeResultConfig,
  GRADE_LETTER_SYSTEMS,
} from '@/lib/form-options';
import { TARGET_COUNTRIES } from '@/lib/validation/lead';
import { ProgramField, splitProgram } from '@/components/form/program-field';
import { LEAD_SOURCES, SOURCE_LABELS, isReferenceSource } from '@/lib/leads/display';

/** Applicant-editable fields, all held as form strings (numbers coerce server-side). */
export interface LeadEditState {
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  city: string;
  district: string;
  target_country: string;
  utm_source: string;
  reference_name: string;
  reference_note: string;
  passport_number: string;
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
  grade_letter: string;
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

function LField({ label, children }: { label: string; children: ReactElement }) {
  // Explicit htmlFor/id association — accessible for staff and reliably
  // targetable by label in tests. The id is injected into the single control.
  const id = useId();
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-xs font-semibold uppercase tracking-[0.14em] text-tenant-accent"
      >
        {label}
      </label>
      {cloneElement(children, { id } as { id: string })}
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
  // React state updates aren't guaranteed to have re-rendered (and re-bound
  // the Save button's onClick to a fresh closure) by the time a very-quick
  // click follows the last keystroke — a ref updated synchronously in the
  // same call as setForm means save() always reads the true latest value,
  // regardless of render timing.
  const formRef = useRef(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof LeadEditState>(k: K, v: LeadEditState[K]) {
    const next = { ...formRef.current, [k]: v };
    formRef.current = next;
    setForm(next);
  }

  function cancel() {
    formRef.current = initial;
    setForm(initial);
    setError(null);
    setEditing(false);
  }

  function save() {
    setError(null);
    start(async () => {
      const res = await updateLead(leadId, formRef.current);
      if (!res.ok) {
        setError(res.error ?? 'Could not save changes.');
        return;
      }
      setEditing(false);
      router.refresh();
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
          <Button
            size="sm"
            className="bg-tenant-accent text-white hover:bg-tenant-accent/90"
            onClick={save}
            disabled={pending}
          >
            {pending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Contact */}
      <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
        <CardHeader>
          <CardTitle className="font-tenant-display">Contact</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <LField label="Full name">{text('full_name')}</LField>
          <LField label="Email">{text('email', 'email')}</LField>
          <LField label="Phone">{text('phone', 'tel')}</LField>
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
          <LField label="Source">
            <Select
              value={form.utm_source}
              disabled={pending}
              onChange={(e) => set('utm_source', e.target.value)}
            >
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
              ))}
            </Select>
          </LField>
          <LField label="Passport number">{text('passport_number')}</LField>
          {isReferenceSource(form.utm_source) && (
            <>
              <LField label="Name">{text('reference_name')}</LField>
              <LField label="Note">{text('reference_note')}</LField>
            </>
          )}
        </CardContent>
      </Card>

      {/* Background */}
      <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
        <CardHeader>
          <CardTitle className="font-tenant-display">Background</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <LField label="Date of birth">{text('date_of_birth', 'date')}</LField>
          <LField label="City">{text('city')}</LField>
          <LField label="District">{text('district')}</LField>
          <LField label="Highest education level">
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
          <LField label="Last qualification / field">{text('last_qualification')}</LField>
          <LField label="Institution / board attended">{text('prior_institution')}</LField>
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
              onChange={(e) => {
                const next = e.target.value;
                // Clear whichever result field no longer applies — otherwise
                // switching from, say, CGPA to Grade could leave the old
                // numeric result saved alongside the new letter grade.
                const isLetter = (GRADE_LETTER_SYSTEMS as readonly string[]).includes(next);
                const merged = {
                  ...formRef.current,
                  grading_system: next,
                  grade_value: isLetter ? '' : formRef.current.grade_value,
                  grade_letter: isLetter ? formRef.current.grade_letter : '',
                };
                formRef.current = merged;
                setForm(merged);
              }}
            >
              <option value="">Select…</option>
              {withCurrent(GRADING_SYSTEMS.map((g) => g.value), form.grading_system).map((v) => (
                <option key={v} value={v}>{CODE_LABELS[v] ?? v}</option>
              ))}
            </Select>
          </LField>
          {(() => {
            const cfg = gradeResultConfig(form.grading_system);
            if (!cfg) return null;
            return (
              <LField label={cfg.label}>
                {cfg.kind === 'number'
                  ? text('grade_value', 'number')
                  : text('grade_letter')}
              </LField>
            );
          })()}
          <LField label="Work experience (years)">
            {text('work_experience_years', 'number')}
          </LField>
          <LField label="Current / recent role">
            {text('work_experience_detail')}
          </LField>
        </CardContent>
      </Card>

      {/* Goals */}
      <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
        <CardHeader>
          <CardTitle className="font-tenant-display">Goals</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <LField label="Preferred institution (abroad)">{text('institution')}</LField>
          <LField label="How will they fund their studies?">
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
          <div className="col-span-2 sm:col-span-3">
            <LField label="Program of interest">
              <ProgramField
                defaultDegree={splitProgram(form.program).degree}
                defaultField={splitProgram(form.program).field}
                onChange={(v) => set('program', v)}
              />
            </LField>
          </div>
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
          <LField label="English proficiency test">
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
          <LField label="Overall score">{text('english_score', 'number')}</LField>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <Checkbox
              checked={form.prior_rejection}
              disabled={pending}
              onChange={(e) => set('prior_rejection', e.target.checked)}
            />
            Prior visa rejection
          </label>
          {form.prior_rejection && (
            <LField label="Briefly, what happened?">
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
