'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createQuery, uploadLeadDocument, type CreateQueryState } from '@/app/(admin)/leads/actions';
import type { QuickLeadInput } from '@/lib/validation/lead';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { EmailField } from '@/components/form/email-field';
import { PhoneField } from '@/components/form/phone-field';
import { DobField } from '@/components/form/dob-field';
import { CountryField } from '@/components/form/country-field';
import { EducationField } from '@/components/form/education-field';
import { ProgramField, splitProgram } from '@/components/form/program-field';
import {
  GRADING_SYSTEMS,
  ENGLISH_TESTS,
  INTAKE_SEASONS,
  FUNDING_SOURCES,
  PASSING_YEARS,
  INTAKE_YEARS,
} from '@/lib/form-options';
import { LEAD_SOURCES, SOURCE_LABELS, isReferenceSource } from '@/lib/leads/display';

const init: CreateQueryState = { ok: false };
const SCORED_TESTS = ['ielts', 'toefl', 'pte', 'duolingo'];

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-destructive">{message}</p>;
}

/**
 * Everything on one page, nothing required — Save whatever's known. Rendered
 * inside the "Create query" dialog on /leads; `onClose` closes that dialog
 * (used for both Cancel and right before navigating away on success).
 */
export function QuickQueryForm({
  consentName,
  onClose,
  initial,
}: {
  consentName: string;
  onClose?: () => void;
  /** Pre-fill from AI-parsed pasted text — staff still reviews before saving. */
  initial?: Partial<QuickLeadInput>;
}) {
  const router = useRouter();
  const [priorRejection, setPriorRejection] = useState(initial?.prior_rejection ?? false);
  const [englishTest, setEnglishTest] = useState(initial?.english_test ?? '');
  const [source, setSource] = useState(initial?.utm_source ?? '');
  const [document, setDocument] = useState<File | null>(null);
  const { degree: initialDegree, field: initialField } = splitProgram(initial?.program ?? '');
  const [uploading, setUploading] = useState(false);
  const [state, action, pending] = useActionState(createQuery, init);
  const err = state.fieldErrors ?? {};
  // Strict Mode invokes effects twice in dev — guard against uploading the
  // same picked file twice for the same freshly created lead.
  const uploadedForLeadId = useRef<string | null>(null);

  useEffect(() => {
    if (!state.ok || !state.leadId) return;
    if (uploadedForLeadId.current === state.leadId) return;
    uploadedForLeadId.current = state.leadId;

    if (!document) {
      onClose?.();
      router.push(`/leads/${state.leadId}`);
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.set('file', document);
    uploadLeadDocument(state.leadId, formData).finally(() => {
      onClose?.();
      router.push(`/leads/${state.leadId}`);
    });
  }, [state, router, onClose, document]);

  return (
    <form action={action} className="space-y-6">
      {state.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <section className="space-y-4 rounded-xl border border-tenant-ink/10 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-tenant-accent">
          Contact
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" name="full_name" autoComplete="name" defaultValue={initial?.full_name} />
          <FieldError message={err.full_name} />
        </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <EmailField error={err.email} required={false} defaultValue={initial?.email} />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <PhoneField error={err.phone} defaultValue={initial?.phone} />
          </div>
          <div>
          <Label htmlFor="target_country">Target country</Label>
          <CountryField error={err.target_country} defaultCountryName={initial?.target_country} />
        </div>
          <div>
            <Label htmlFor="utm_source">Source</Label>
            <Select
              id="utm_source"
              name="utm_source"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              <option value="">Select…</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="passport_number">Passport number</Label>
            <Input id="passport_number" name="passport_number" placeholder="Optional" defaultValue={initial?.passport_number} />
          </div>
          <div>
            <Label htmlFor="document">Document</Label>
            <input
              type="file"
              id="document"
              accept="application/pdf,image/png,image/jpeg"
              className="block w-full text-sm text-tenant-ink file:mr-3 file:rounded-md file:border-0 file:bg-tenant-gray file:px-3 file:py-1.5 file:text-sm"
              onChange={(e) => setDocument(e.target.files?.[0] ?? null)}
            />
            <p className="mt-1 text-xs text-muted-foreground">PDF, PNG, or JPG — up to 10MB. Optional.</p>
          </div>
        </div>

        {isReferenceSource(source) && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="reference_name">Name</Label>
              <Input id="reference_name" name="reference_name" placeholder="Who referred them" defaultValue={initial?.reference_name} />
            </div>
            <div>
              <Label htmlFor="reference_note">Note</Label>
              <Input id="reference_note" name="reference_note" placeholder="Optional detail" defaultValue={initial?.reference_note} />
            </div>
          </div>
        )}

        <label className="flex items-start gap-3 text-sm">
          <Checkbox name="consent_given" className="mt-0.5" />
          <span>
            {consentName} has consent to store and process these details to
            contact this person about their application.
          </span>
        </label>
      </section>

      <section className="space-y-4 rounded-xl border border-tenant-ink/10 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-tenant-accent">
          Background
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="date_of_birth">Date of birth</Label>
            <DobField error={err.date_of_birth} defaultValue={initial?.date_of_birth} />
          </div>
          <div>
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" placeholder="e.g. Lahore" autoComplete="address-level2" defaultValue={initial?.city} />
            <FieldError message={err.city} />
          </div>
          <div>
            <Label htmlFor="district">District</Label>
            <Input id="district" name="district" placeholder="e.g. Lahore" defaultValue={initial?.district} />
          </div>
            <div>
            <Label htmlFor="highest_education">Highest education level</Label>
            <EducationField error={err.highest_education} defaultValue={initial?.highest_education} />
          </div>
          <div>
            <Label htmlFor="last_qualification">Last qualification / field</Label>
            <Input id="last_qualification" name="last_qualification" placeholder="e.g. BSc Computer Science" defaultValue={initial?.last_qualification} />
          </div>
          <div>
            <Label htmlFor="prior_institution">Institution / board attended</Label>
            <Input id="prior_institution" name="prior_institution" placeholder="Where they last studied" defaultValue={initial?.prior_institution} />
          </div>
          <div>
            <Label htmlFor="passing_year">Passing year</Label>
            <Select id="passing_year" name="passing_year" defaultValue={initial?.passing_year ? String(initial.passing_year) : ''}>
              <option value="">Select year</option>
              {PASSING_YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="grading_system">Grading system</Label>
            <Select id="grading_system" name="grading_system" defaultValue={initial?.grading_system ?? ''}>
              <option value="">Select grading system</option>
              {GRADING_SYSTEMS.map((x) => (
                <option key={x.value} value={x.value}>{x.label}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="grade_value">Result (CGPA / %)</Label>
            <Input id="grade_value" name="grade_value" type="number" step="0.01" min="0" inputMode="decimal" placeholder="e.g. 3.5 or 85" defaultValue={initial?.grade_value != null ? String(initial.grade_value) : undefined} />
            <FieldError message={err.grade_value} />
          </div>
           <div>
            <Label htmlFor="work_experience_years">Work experience (years)</Label>
            <Input id="work_experience_years" name="work_experience_years" type="number" min="0" max="60" inputMode="numeric" defaultValue={initial?.work_experience_years != null ? String(initial.work_experience_years) : undefined} />
          </div>
          <div>
            <Label htmlFor="work_experience_detail">Current / recent role</Label>
            <Input id="work_experience_detail" name="work_experience_detail" placeholder="Optional" defaultValue={initial?.work_experience_detail} />
          </div>
        </div>


      </section>

      <section className="space-y-4 rounded-xl border border-tenant-ink/10 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-tenant-accent">
          Goals
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="institution">Preferred institution (abroad)</Label>
            <Input id="institution" name="institution" placeholder="University or college" defaultValue={initial?.institution} />
          </div>
          <div>
            <Label htmlFor="funding_source">How will they fund their studies?</Label>
            <Select id="funding_source" name="funding_source" defaultValue={initial?.funding_source ?? ''}>
              <option value="">Select funding source</option>
              {FUNDING_SOURCES.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="program_degree">Program of interest</Label>
          <ProgramField defaultDegree={initialDegree} defaultField={initialField} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="intake_season">Intended intake</Label>
            <div className="grid grid-cols-2 gap-2">
              <Select id="intake_season" name="intake_season" defaultValue={initial?.intake_season ?? ''}>
                <option value="">Season</option>
                {INTAKE_SEASONS.map((x) => (
                  <option key={x.value} value={x.value}>{x.label}</option>
                ))}
              </Select>
              <Select name="intake_year" defaultValue={initial?.intake_year ? String(initial.intake_year) : ''} aria-label="Intake year">
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
            <Input id="english_score" name="english_score" type="number" step="0.5" min="0" inputMode="decimal" placeholder="e.g. IELTS 6.5, TOEFL 90" defaultValue={initial?.english_score != null ? String(initial.english_score) : undefined} />
          </div>
        )}
        <label className="flex items-center gap-3 text-sm">
          <Checkbox name="prior_rejection" checked={priorRejection} onChange={(e) => setPriorRejection(e.target.checked)} />
          Prior visa rejection
        </label>
        {priorRejection && (
          <div>
            <Label htmlFor="prior_rejection_detail">Briefly, what happened?</Label>
            <Textarea id="prior_rejection_detail" name="prior_rejection_detail" rows={3} placeholder="Country, year, and reason if known." defaultValue={initial?.prior_rejection_detail} />
          </div>
        )}
      </section>

      <div className="flex gap-3">
        <Button
          type="submit"
          size="lg"
          className="bg-tenant-accent text-white hover:bg-tenant-accent/90"
          disabled={pending || uploading}
        >
          {uploading ? 'Uploading document…' : pending ? 'Saving…' : 'Save'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => onClose?.()}
          disabled={pending || uploading}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
