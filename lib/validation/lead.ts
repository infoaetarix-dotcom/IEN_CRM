import { z } from 'zod';

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

const phoneRegex = /^\+?[0-9\s\-()]{7,20}$/;

export const leadSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(2, 'Please enter your full name')
      .max(120),
    email: z.string().trim().toLowerCase().email('Enter a valid email').max(254),
    phone: z
      .string()
      .trim()
      .regex(phoneRegex, 'Enter a valid phone number (international format)'),
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
    target_country: z.string().trim().max(80).optional().or(z.literal('')),
    institution: z.string().trim().max(160).optional().or(z.literal('')),
    program: z.string().trim().max(160).optional().or(z.literal('')),
    highest_education: z
      .enum(EDUCATION_LEVELS)
      .optional()
      .or(z.literal('')),
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
  })
  .refine(
    (d) => !d.prior_rejection || (d.prior_rejection_detail ?? '').length > 0,
    {
      message: 'Please add a brief detail about the prior rejection',
      path: ['prior_rejection_detail'],
    },
  );

export type LeadInput = z.infer<typeof leadSchema>;

/** Map an arbitrary utm_source string to the lead_source enum. */
export function normalizeSource(raw: string | undefined | null): string {
  if (!raw) return 'direct';
  const v = raw.toLowerCase().trim();
  return (LEAD_SOURCES as readonly string[]).includes(v) ? v : 'other';
}
