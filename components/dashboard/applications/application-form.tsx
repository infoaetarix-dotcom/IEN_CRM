'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  createApplication,
  updateApplication,
  type ActionState,
} from '@/app/(admin)/applications/actions';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
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

// Re-exported for existing import sites — the type itself lives in
// lib/applications/types.ts so actions.ts (a server module) can reference it
// without importing from this client component file.
export type { ApplicationFormValues } from '@/lib/applications/types';
import type { ApplicationFormValues } from '@/lib/applications/types';

const init: ActionState = { ok: false };

/** Show the current stored value even if it isn't one of the preset options. */
function withCurrent(options: readonly string[], current: string): string[] {
  return current && !options.includes(current) ? [current, ...options] : [...options];
}

/**
 * Copy-then-edit form for an application — the lead form's field set (same
 * options, same layout) plus a passport number. Used both to create (values
 * pre-filled from the parent lead) and to edit an existing application.
 * Status isn't editable here — it's a separate control on the detail page,
 * same as StatusChanger for leads — so this always carries the current
 * status through as a hidden field, unchanged, rather than letting a save
 * here silently reset it.
 */
export function ApplicationForm({
  leadId,
  applicationId,
  initial,
  onSaved,
  onCancel,
}: {
  leadId: string;
  applicationId?: string;
  initial: ApplicationFormValues;
  /** Edit mode only — called after a successful save, e.g. to flip a parent toggle back to read-only view. */
  onSaved?: () => void;
  /** Create mode only — overrides the default Cancel behavior (navigating to
   *  the parent lead), e.g. to close a dialog this form is rendered inside. */
  onCancel?: () => void;
}) {
  const router = useRouter();
  const isEdit = !!applicationId;
  const action = isEdit
    ? updateApplication.bind(null, applicationId)
    : createApplication.bind(null, leadId);
  const [state, formAction, pending] = useActionState(action, init);
  const [priorRejection, setPriorRejection] = useState(initial.prior_rejection);

  useEffect(() => {
    if (state.ok) {
      if (!isEdit && state.applicationId) {
        router.push(`/applications/${state.applicationId}`);
      } else {
        router.refresh();
        onSaved?.();
      }
    }
  }, [state, router, isEdit, onSaved]);

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="status" defaultValue={initial.status} />

      {state.error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
        <CardHeader>
          <CardTitle className="font-tenant-display">Contact &amp; location</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="full_name">Full name</Label>
            <Input id="full_name" name="full_name" defaultValue={initial.full_name} disabled={pending} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={initial.email} disabled={pending} />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" type="tel" defaultValue={initial.phone} disabled={pending} />
          </div>
          <div>
            <Label htmlFor="date_of_birth">Date of birth</Label>
            <Input id="date_of_birth" name="date_of_birth" type="date" defaultValue={initial.date_of_birth} disabled={pending} />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" defaultValue={initial.city} disabled={pending} />
          </div>
          <div>
            <Label htmlFor="district">District</Label>
            <Input id="district" name="district" defaultValue={initial.district} disabled={pending} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
        <CardHeader>
          <CardTitle className="font-tenant-display">Prior education &amp; experience</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="highest_education">Highest education</Label>
            <Select id="highest_education" name="highest_education" defaultValue={initial.highest_education} disabled={pending}>
              <option value="">Select…</option>
              {withCurrent(EDUCATION_OPTIONS, initial.highest_education).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="last_qualification">Qualification</Label>
            <Select id="last_qualification" name="last_qualification" defaultValue={initial.last_qualification} disabled={pending}>
              <option value="">Select…</option>
              {withCurrent(DEGREE_OPTIONS, initial.last_qualification).map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="prior_institution">Institution attended</Label>
            <Input id="prior_institution" name="prior_institution" defaultValue={initial.prior_institution} disabled={pending} />
          </div>
          <div>
            <Label htmlFor="passing_year">Passing year</Label>
            <Select id="passing_year" name="passing_year" defaultValue={initial.passing_year} disabled={pending}>
              <option value="">Select…</option>
              {PASSING_YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="grading_system">Grading system</Label>
            <Select id="grading_system" name="grading_system" defaultValue={initial.grading_system} disabled={pending}>
              <option value="">Select…</option>
              {GRADING_SYSTEMS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="grade_value">Result</Label>
            <Input id="grade_value" name="grade_value" type="number" step="0.01" defaultValue={initial.grade_value} disabled={pending} />
          </div>
          <div>
            <Label htmlFor="work_experience_years">Work experience (years)</Label>
            <Input id="work_experience_years" name="work_experience_years" type="number" defaultValue={initial.work_experience_years} disabled={pending} />
          </div>
          <div>
            <Label htmlFor="work_experience_detail">Work experience detail</Label>
            <Input id="work_experience_detail" name="work_experience_detail" defaultValue={initial.work_experience_detail} disabled={pending} />
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
        <CardHeader>
          <CardTitle className="font-tenant-display">Study goals</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="target_country">Target country</Label>
            <Select id="target_country" name="target_country" defaultValue={initial.target_country} disabled={pending}>
              <option value="">Select…</option>
              {withCurrent(TARGET_COUNTRIES, initial.target_country).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="institution">Preferred institution</Label>
            <Input id="institution" name="institution" defaultValue={initial.institution} disabled={pending} />
          </div>
          <div>
            <Label htmlFor="program">Program</Label>
            <Input id="program" name="program" defaultValue={initial.program} disabled={pending} />
          </div>
          <div>
            <Label htmlFor="intake_season">Intake season</Label>
            <Select id="intake_season" name="intake_season" defaultValue={initial.intake_season} disabled={pending}>
              <option value="">Select…</option>
              {INTAKE_SEASONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="intake_year">Intake year</Label>
            <Select id="intake_year" name="intake_year" defaultValue={initial.intake_year} disabled={pending}>
              <option value="">Select…</option>
              {INTAKE_YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="english_test">English test</Label>
            <Select id="english_test" name="english_test" defaultValue={initial.english_test} disabled={pending}>
              <option value="">Select…</option>
              {ENGLISH_TESTS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="english_score">English score</Label>
            <Input id="english_score" name="english_score" type="number" step="0.5" defaultValue={initial.english_score} disabled={pending} />
          </div>
          <div>
            <Label htmlFor="funding_source">Funding source</Label>
            <Select id="funding_source" name="funding_source" defaultValue={initial.funding_source} disabled={pending}>
              <option value="">Select…</option>
              {FUNDING_SOURCES.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <Checkbox
              name="prior_rejection"
              checked={priorRejection}
              disabled={pending}
              onChange={(e) => setPriorRejection(e.target.checked)}
            />
            Prior visa rejection
          </label>
          {priorRejection && (
            <div className="sm:col-span-2">
              <Label htmlFor="prior_rejection_detail">Rejection detail</Label>
              <Textarea
                id="prior_rejection_detail"
                name="prior_rejection_detail"
                rows={2}
                defaultValue={initial.prior_rejection_detail}
                disabled={pending}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
        <CardHeader>
          <CardTitle className="font-tenant-display">Application details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="passport_number">Passport number</Label>
            <Input id="passport_number" name="passport_number" defaultValue={initial.passport_number} disabled={pending} />
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          type="submit"
          className="bg-tenant-accent text-white hover:bg-tenant-accent/90"
          disabled={pending}
        >
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create application'}
        </Button>
        {!isEdit && (
          <Button
            type="button"
            variant="outline"
            onClick={() => (onCancel ? onCancel() : router.push(`/leads/${leadId}`))}
          >
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
