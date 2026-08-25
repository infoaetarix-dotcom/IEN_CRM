import { z } from 'zod';
import {
  leadObject,
  priorRejectionOk,
  PRIOR_REJECTION_MSG,
  gradeInRange,
  GRADE_MSG,
} from './lead';
import { APPLICATION_STATUSES } from '@/lib/leads/display';

const applicationFields = leadObject
  .pick({
    full_name: true,
    email: true,
    phone: true,
    date_of_birth: true,
    city: true,
    district: true,
    target_country: true,
    program: true,
    intake_season: true,
    intake_year: true,
    highest_education: true,
    last_qualification: true,
    prior_institution: true,
    passing_year: true,
    grading_system: true,
    grade_value: true,
    work_experience_years: true,
    work_experience_detail: true,
    english_test: true,
    english_score: true,
    funding_source: true,
    prior_rejection: true,
    prior_rejection_detail: true,
  })
  .partial()
  .extend({
    passport_number: z.string().trim().max(40).optional(),
    status: z.enum(APPLICATION_STATUSES).default('new'),
    // Unlike everything else here, this is deliberately required — every
    // application must be linked to a university from Settings (see
    // 0027_universities.sql). It's a real application, not lead-stage
    // guesswork, so "which university" isn't optional the way the rest of
    // the copied-from-lead fields are.
    university_id: z.string().uuid('Choose which university this application is for'),
  });

/**
 * An application's form is the lead form (same fields, same option lists,
 * same per-field rules — reused directly from lib/validation/lead.ts rather
 * than duplicated) plus application-only additions: passport_number, status,
 * and university_id. Same exclusions as leadEditSchema: no consent/UTM/
 * honeypot — those are lead-acquisition specific and applications have no
 * public form at all.
 *
 * Everything from the lead is `.partial()` — unlike leadEditSchema, none of
 * it is required. A lead this copies from is very often incomplete (a
 * phone-only "quick query", an abandoned public-form submission, a lead
 * nobody has finished qualifying yet), and blocking "Create application"
 * until every field is backfilled would defeat the point of the
 * copy-then-edit flow. Same reasoning as quickLeadSchema
 * (lib/validation/lead.ts) — whatever's missing stays missing, whatever's
 * present is still validated against the same per-field rules (e.g. a phone
 * number, if given, still has to be a real one). university_id is the one
 * deliberate exception to "nothing is required" — see above.
 */
export const applicationEditSchema = z.preprocess((raw) => {
  if (typeof raw !== 'object' || raw === null) return raw;
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    cleaned[k] = v === '' ? undefined : v;
  }
  return cleaned;
}, applicationFields
  .refine(priorRejectionOk, PRIOR_REJECTION_MSG)
  .refine(gradeInRange, GRADE_MSG));

export type ApplicationEditInput = z.infer<typeof applicationEditSchema>;

export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024; // 10MB
export const DOCUMENT_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
] as const;
