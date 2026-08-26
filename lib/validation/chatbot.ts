import { z } from 'zod';

/** POST /api/chatbot — send one message in a (possibly new) conversation. */
export const chatSendSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1, 'Say something first.').max(4000),
});

export type ChatSendInput = z.infer<typeof chatSendSchema>;

/** POST /api/chatbot/extract-lead */
export const extractLeadSchema = z.object({
  text: z.string().trim().min(1, 'Paste something first.').max(6000),
});

/**
 * What the model is allowed to return from pasted text — every field
 * optional/sanitized, exactly like quickLeadSchema treats staff input.
 * Deliberately narrower than trusting arbitrary model JSON directly: unknown
 * keys are dropped, and every value still passes through the same field
 * rules quickLeadSchema already enforces at save time (this is a prefill
 * only, never a save).
 */
export const extractedLeadSchema = z.object({
  full_name: z.string().trim().max(120).optional(),
  email: z.string().trim().max(254).optional(),
  phone: z.string().trim().max(40).optional(),
  date_of_birth: z.string().trim().max(10).optional(),
  city: z.string().trim().max(80).optional(),
  district: z.string().trim().max(80).optional(),
  target_country: z.string().trim().max(80).optional(),
  institution: z.string().trim().max(160).optional(),
  program: z.string().trim().max(160).optional(),
  intake_season: z.string().trim().max(20).optional(),
  intake_year: z.coerce.number().int().optional(),
  highest_education: z.string().trim().max(100).optional(),
  last_qualification: z.string().trim().max(160).optional(),
  prior_institution: z.string().trim().max(160).optional(),
  passing_year: z.coerce.number().int().optional(),
  grading_system: z.string().trim().max(20).optional(),
  grade_value: z.coerce.number().optional(),
  work_experience_years: z.coerce.number().int().optional(),
  work_experience_detail: z.string().trim().max(300).optional(),
  english_test: z.string().trim().max(20).optional(),
  english_score: z.coerce.number().optional(),
  funding_source: z.string().trim().max(20).optional(),
  prior_rejection: z.boolean().optional(),
  prior_rejection_detail: z.string().trim().max(1000).optional(),
  utm_source: z.string().trim().max(30).optional(),
  reference_name: z.string().trim().max(160).optional(),
  reference_note: z.string().trim().max(1000).optional(),
  passport_number: z.string().trim().max(40).optional(),
});

export type ExtractedLead = z.infer<typeof extractedLeadSchema>;
