import { z } from 'zod';
import { isValidPhoneNumber } from 'libphonenumber-js';
import {
  GRADING_VALUES,
  ENGLISH_VALUES,
  INTAKE_SEASON_VALUES,
  FUNDING_VALUES,
} from '@/lib/form-options';

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

export const LEAD_SOURCES = [
  'instagram',
  'facebook',
  'linkedin',
  'youtube',
  'whatsapp',
  'direct',
  'other',
] as const;

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
    grade_value: reqNum(
      z
        .number({
          required_error: 'Please enter your result',
          invalid_type_error: 'Please enter your result',
        })
        .min(0, 'Invalid result'),
    ),
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
    // Honeypot — must stay empty. Bots fill it.
    company: z.string().max(0).optional(),
} as const;

const priorRejectionOk = (d: {
  prior_rejection?: boolean;
  prior_rejection_detail?: string;
}) => !d.prior_rejection || (d.prior_rejection_detail ?? '').length > 0;
const PRIOR_REJECTION_MSG = {
  message: 'Please add a brief detail about the prior rejection',
  path: ['prior_rejection_detail'] as (string | number)[],
};

const gradeInRange = (d: { grade_value?: number; grading_system?: string }) => {
  if (d.grade_value == null || !d.grading_system) return true;
  if (d.grading_system === 'cgpa_4') return d.grade_value <= 4.0;
  if (d.grading_system === 'cgpa_5') return d.grade_value <= 5.0;
  if (d.grading_system === 'percentage') return d.grade_value <= 100;
  return true;
};
const GRADE_MSG = {
  message: 'Result is out of range for the selected grading system',
  path: ['grade_value'] as (string | number)[],
};

const leadObject = z.object(leadFields);

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
    work_experience_years: true,
    work_experience_detail: true,
  })
  .refine(gradeInRange, GRADE_MSG);

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

export type LeadInput = z.infer<typeof leadSchema>;

/** Map an arbitrary utm_source string to the lead_source enum. */
export function normalizeSource(raw: string | undefined | null): string {
  if (!raw) return 'direct';
  const v = raw.toLowerCase().trim();
  return (LEAD_SOURCES as readonly string[]).includes(v) ? v : 'other';
}
