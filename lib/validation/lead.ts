import { z } from 'zod';
import { isValidPhoneNumber } from 'libphonenumber-js';
import {
  GRADING_VALUES,
  GRADE_LETTER_SYSTEMS,
  ENGLISH_VALUES,
  INTAKE_SEASON_VALUES,
  FUNDING_VALUES,
} from '@/lib/form-options';
import { LEAD_SOURCES } from '@/lib/leads/display';

const CURRENT_YEAR = new Date().getFullYear();

/** Optional free text, empty string allowed (form sends '' for blanks). */
const optText = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(''));

/** Turn a form string into a number: '' / bad input → undefined. */
const numPre = (v: unknown) => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
};

/** Optional number from a form string. */
const optNum = (schema: z.ZodNumber) => z.preprocess(numPre, schema.optional());

/** Required number from a form string. */
const reqNum = (schema: z.ZodNumber) => z.preprocess(numPre, schema);

/** Required standardized code — must be one of `values`. */
const reqCode = (values: readonly string[], msg: string) =>
  z.string().min(1, msg).refine((v) => values.includes(v), 'Invalid selection');

/** Optional standardized code — must be blank or one of `values`. */
const optCode = (values: readonly string[]) =>
  z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || values.includes(v), 'Invalid selection');

/**
 * Single source of truth for lead validation — shared by the client form (UX)
 * and the server action (the real security boundary; the server re-validates).
 */

export const EDUCATION_LEVELS = [
  'high_school',
  'diploma',
  'bachelors',
  'masters',
  'doctorate',
  'other',
] as const;

// Common study-abroad destinations; free `other` is allowed via the select.
export const TARGET_COUNTRIES = [
  'United Kingdom',
  'United States',
  'Canada',
  'Australia',
  'Germany',
  'Ireland',
  'New Zealand',
  'Other',
] as const;

const MIN_AGE = 14;
const MAX_AGE = 120;

/** Derive integer age from a Date (used to range-check date of birth). */
function ageFrom(date: Date): number {
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const m = now.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) age--;
  return age;
}

// Field definitions live in one object so the full schema AND the per-step
// wizard schemas can share them (single source of truth).
const leadFields = {
    full_name: z
      .string()
      .trim()
      .min(2, 'Please enter your full name')
      .max(120),
    email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
    // E.164 from the international phone input; validated per-country length.
    phone: z
      .string()
      .trim()
      .min(1, 'Phone number is required')
      .refine(
        (v) => isValidPhoneNumber(v),
        'Enter a valid phone number for the selected country',
      ),
    // Date of birth (YYYY-MM-DD). Age is derived and range-checked below.
    date_of_birth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date of birth')
      .refine((s) => !Number.isNaN(new Date(s).getTime()), 'Invalid date')
      .refine((s) => new Date(s) <= new Date(), 'Date cannot be in the future')
      .refine((s) => {
        const age = ageFrom(new Date(s));
        return age >= MIN_AGE && age <= MAX_AGE;
      }, `Applicant age must be between ${MIN_AGE} and ${MAX_AGE}`),
    // Location — city required, district optional
    city: z.string().trim().min(1, 'Please enter your city').max(80),
    district: optText(80),
    // Study goals (target side) — target_country is required
    target_country: z
      .string()
      .trim()
      .min(1, 'Please select your target country')
      .max(80),
    institution: optText(160),
    program: optText(160),
    intake_season: optCode(INTAKE_SEASON_VALUES),
    intake_year: optNum(z.number().int().min(2024).max(2035)),
    // Prior education — highest_education is required (select incl. "Other")
    highest_education: z
      .string()
      .trim()
      .min(1, 'Please select your highest education')
      .max(100),
    last_qualification: z
      .string()
      .trim()
      .min(1, 'Please enter your last qualification')
      .max(160),
    prior_institution: z
      .string()
      .trim()
      .min(1, 'Please enter the institution you attended')
      .max(160),
    passing_year: reqNum(
      z
        .number({
          required_error: 'Please select your passing year',
          invalid_type_error: 'Please select your passing year',
        })
        .int()
        .min(1950, 'Invalid year')
        .max(CURRENT_YEAR + 1, 'Invalid year'),
    ),
    grading_system: reqCode(GRADING_VALUES, 'Please select a grading system'),
    // Numeric result (CGPA/percentage/other) — required only when a system
    // that uses it is selected; see gradeResultOk below. grade_letter, right
    // after, is its counterpart for the 'grade' (letter/division) system.
    grade_value: optNum(z.number().min(0, 'Invalid result')),
    grade_letter: optText(40),
    // Experience
    work_experience_years: optNum(z.number().int().min(0).max(60)),
    work_experience_detail: optText(300),
    // English proficiency
    english_test: optCode(ENGLISH_VALUES),
    english_score: optNum(z.number().min(0).max(120)),
    // Funding
    funding_source: optCode(FUNDING_VALUES),
    prior_rejection: z.boolean().default(false),
    prior_rejection_detail: z.string().trim().max(1000).optional().or(z.literal('')),
    consent_given: z.literal(true, {
      errorMap: () => ({ message: 'You must consent to proceed' }),
    }),
    // UTM (hidden) — captured from the query string.
    utm_source: z.string().optional(),
    utm_medium: z.string().optional(),
    utm_campaign: z.string().optional(),
    // Who referred this lead — only shown/editable when utm_source is
    // personal_reference or old_student_reference (see lib/leads/display.ts).
    reference_name: optText(160),
    reference_note: optText(1000),
    // Staff-facing only (Create query + lead editor) — no public form field.
    passport_number: optText(40),
    // Honeypot — must stay empty. Bots fill it.
    company: z.string().max(0).optional(),
} as const;

/**
 * Exported (not just used internally) — the applications feature reuses this
 * exact object plus these two cross-field checks, since an application's
 * form is the lead form plus two extra fields (see lib/validation/application.ts).
 */
export const priorRejectionOk = (d: {
  prior_rejection?: boolean;
  prior_rejection_detail?: string;
}) => !d.prior_rejection || (d.prior_rejection_detail ?? '').length > 0;
export const PRIOR_REJECTION_MSG = {
  message: 'Please add a brief detail about the prior rejection',
  path: ['prior_rejection_detail'] as (string | number)[],
};

export const gradeInRange = (d: { grade_value?: number; grading_system?: string }) => {
  if (d.grade_value == null || !d.grading_system) return true;
  if (d.grading_system === 'cgpa_4') return d.grade_value <= 4.0;
  if (d.grading_system === 'cgpa_5') return d.grade_value <= 5.0;
  if (d.grading_system === 'percentage') return d.grade_value <= 100;
  return true;
};
export const GRADE_MSG = {
  message: 'Result is out of range for the selected grading system',
  path: ['grade_value'] as (string | number)[],
};

/**
 * Public-form-only: once a grading system is picked, its matching result
 * field becomes required — grade_letter for 'grade', grade_value for
 * everything else. Create Query and the lead editor never apply this (both
 * stay fully optional), so it's wired into step2Schema alone, not
 * leadObject/leadSchema.
 */
function requireGradeResult(
  d: { grading_system?: string; grade_value?: number; grade_letter?: string },
  ctx: z.RefinementCtx,
) {
  if (!d.grading_system) return;
  if ((GRADE_LETTER_SYSTEMS as readonly string[]).includes(d.grading_system)) {
    if (!d.grade_letter || d.grade_letter.trim().length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Please enter your result', path: ['grade_letter'] });
    }
    return;
  }
  if (d.grade_value == null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Please enter your result', path: ['grade_value'] });
  }
}

export const leadObject = z.object(leadFields);

export const leadSchema = leadObject
  .refine(priorRejectionOk, PRIOR_REJECTION_MSG)
  .refine(gradeInRange, GRADE_MSG);

// ---- Per-step schemas for the 3-step wizard (progressive capture) ----
// Step 1: contact + target country + consent (saved first — the "hook").
export const step1Schema = leadObject.pick({
  full_name: true,
  email: true,
  phone: true,
  target_country: true,
  consent_given: true,
  company: true,
  utm_source: true,
  utm_medium: true,
  utm_campaign: true,
});

// Step 2: background — DOB, location, prior education.
export const step2Schema = leadObject
  .pick({
    date_of_birth: true,
    city: true,
    district: true,
    highest_education: true,
    last_qualification: true,
    prior_institution: true,
    passing_year: true,
    grading_system: true,
    grade_value: true,
    grade_letter: true,
    work_experience_years: true,
    work_experience_detail: true,
  })
  .refine(gradeInRange, GRADE_MSG)
  .superRefine(requireGradeResult);

// Step 3: study goals — all optional (never blocks completion).
export const step3Schema = leadObject
  .pick({
    institution: true,
    program: true,
    intake_season: true,
    intake_year: true,
    english_test: true,
    english_score: true,
    funding_source: true,
    prior_rejection: true,
    prior_rejection_detail: true,
  })
  .refine(priorRejectionOk, PRIOR_REJECTION_MSG);

// Dashboard lead editor — the applicant-provided fields staff may correct,
// plus utm_source (staff can reassign a lead's source manually — see
// 0031_reference_lead_sources.sql). Still excludes consent, utm_medium/
// utm_campaign, and the honeypot (system/audit fields that must never be
// hand-edited). Reuses the same field rules + cross-field checks.
//
// Every field, including full name, email, and phone, is optional/clearable
// — same "save whatever you have" spirit as quickLeadSchema below. A lead
// saved with none of the three can't be contacted (breaks outbound email,
// WhatsApp, and the leads list) until filled back in — an accepted
// tradeoff, not an oversight; leads.full_name/email/phone were relaxed from
// NOT NULL in 0042_lead_contact_optional.sql to allow it.
export const leadEditSchema = z.preprocess((raw) => {
  if (typeof raw !== 'object' || raw === null) return raw;
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    cleaned[k] = v === '' ? undefined : v;
  }
  return cleaned;
}, leadObject
  .pick({
    full_name: true,
    email: true,
    phone: true,
    date_of_birth: true,
    city: true,
    district: true,
    target_country: true,
    institution: true,
    program: true,
    intake_season: true,
    intake_year: true,
    highest_education: true,
    last_qualification: true,
    prior_institution: true,
    passing_year: true,
    grading_system: true,
    grade_value: true,
    grade_letter: true,
    work_experience_years: true,
    work_experience_detail: true,
    english_test: true,
    english_score: true,
    funding_source: true,
    prior_rejection: true,
    prior_rejection_detail: true,
    utm_source: true,
    reference_name: true,
    reference_note: true,
    passport_number: true,
  })
  .partial()
  .refine(priorRejectionOk, PRIOR_REJECTION_MSG)
  .refine(gradeInRange, GRADE_MSG));

export type LeadEditInput = z.infer<typeof leadEditSchema>;

/**
 * Staff "Create Query" flow (the dialog on /leads) — same fields as the
 * public wizard, but every one of them is optional: a staff member taking a
 * partial phone query needs to save whatever they have, not be blocked by
 * missing fields. Blank strings are treated as "not provided" (not as
 * invalid values) so the underlying field validators only run when a value
 * is actually present. consent_given drops the literal(true) requirement —
 * it can be true, false, or omitted.
 */
export const quickLeadSchema = z.preprocess((raw) => {
  if (typeof raw !== 'object' || raw === null) return raw;
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    cleaned[k] = v === '' ? undefined : v;
  }
  return cleaned;
}, leadObject
  .partial()
  .extend({ consent_given: z.boolean().default(false) })
  .refine(priorRejectionOk, PRIOR_REJECTION_MSG)
  .refine(gradeInRange, GRADE_MSG));

export type QuickLeadInput = z.infer<typeof quickLeadSchema>;

export type LeadInput = z.infer<typeof leadSchema>;

/** Map an arbitrary utm_source string to the lead_source enum. */
export function normalizeSource(raw: string | undefined | null): string {
  if (!raw) return 'direct';
  const v = raw.toLowerCase().trim();
  return (LEAD_SOURCES as readonly string[]).includes(v) ? v : 'other';
}
