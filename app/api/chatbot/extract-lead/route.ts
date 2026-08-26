import 'server-only';

import type { NextRequest } from 'next/server';
import { requireChatbotAccess } from '@/lib/chatbot/guard';
import { callLLM } from '@/lib/chatbot/provider';
import { extractLeadSchema, type ExtractedLead } from '@/lib/validation/chatbot';
import { GRADING_VALUES, ENGLISH_VALUES, INTAKE_SEASON_VALUES, FUNDING_VALUES } from '@/lib/form-options';
import { LEAD_SOURCES } from '@/lib/leads/display';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXTRACT_SYSTEM_PROMPT = `
You extract structured lead data from raw, unstructured text a staff member
pastes in (a WhatsApp message, an email, notes taken over a phone call —
any format, any field order, fields may be missing or labeled loosely).

Return ONLY a single JSON object with any of these keys you can confidently
fill in from the text — omit keys you cannot determine, never guess or
invent a value that isn't actually implied by the text:

full_name, email, phone, date_of_birth (YYYY-MM-DD), city, district,
target_country, institution, program, intake_season (spring/summer/fall/winter),
intake_year (number), highest_education, last_qualification, prior_institution,
passing_year (number), grading_system (percentage/cgpa_4/cgpa_5), grade_value (number),
work_experience_years (number), work_experience_detail, english_test (ielts/toefl/pte/duolingo/none),
english_score (number), funding_source (self/family/loan/scholarship/sponsor),
prior_rejection (boolean), prior_rejection_detail, utm_source (one of: ${LEAD_SOURCES.join(', ')}),
reference_name, reference_note, passport_number.

Never include a "notes" or free-form key that isn't in this list. If the
text contains nothing recognizable, return {}.
`.trim();

function pickString(v: unknown, max: number): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}
function pickNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}
function pickBool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined;
}
function pickCode(v: unknown, allowed: readonly string[]): string | undefined {
  const s = pickString(v, 20);
  return s && (allowed as readonly string[]).includes(s) ? s : undefined;
}

/**
 * Defensive, field-by-field sanitizer rather than a single zod .safeParse —
 * one malformed field from the model (e.g. a non-numeric "intake_year")
 * shouldn't discard every other field it got right. This only ever prefills
 * a form the staff member reviews before saving, so "best effort, drop what
 * doesn't fit" is the right failure mode, not "reject everything."
 */
function sanitize(raw: unknown): ExtractedLead {
  if (typeof raw !== 'object' || raw === null) return {};
  const r = raw as Record<string, unknown>;
  return {
    full_name: pickString(r.full_name, 120),
    email: pickString(r.email, 254),
    phone: pickString(r.phone, 40),
    date_of_birth: pickString(r.date_of_birth, 10),
    city: pickString(r.city, 80),
    district: pickString(r.district, 80),
    target_country: pickString(r.target_country, 80),
    institution: pickString(r.institution, 160),
    program: pickString(r.program, 160),
    intake_season: pickCode(r.intake_season, INTAKE_SEASON_VALUES),
    intake_year: pickNumber(r.intake_year),
    highest_education: pickString(r.highest_education, 100),
    last_qualification: pickString(r.last_qualification, 160),
    prior_institution: pickString(r.prior_institution, 160),
    passing_year: pickNumber(r.passing_year),
    grading_system: pickCode(r.grading_system, GRADING_VALUES),
    grade_value: pickNumber(r.grade_value),
    work_experience_years: pickNumber(r.work_experience_years),
    work_experience_detail: pickString(r.work_experience_detail, 300),
    english_test: pickCode(r.english_test, ENGLISH_VALUES),
    english_score: pickNumber(r.english_score),
    funding_source: pickCode(r.funding_source, FUNDING_VALUES),
    prior_rejection: pickBool(r.prior_rejection),
    prior_rejection_detail: pickString(r.prior_rejection_detail, 1000),
    utm_source: pickCode(r.utm_source, LEAD_SOURCES),
    reference_name: pickString(r.reference_name, 160),
    reference_note: pickString(r.reference_note, 1000),
    passport_number: pickString(r.passport_number, 40),
  };
}

function stripJsonFences(s: string): string {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] ?? s).trim();
}

/**
 * One-shot, tool-less extraction — no `tools` array is ever bound here, so
 * there's no risk of the model deciding to act on ambiguous text. It can
 * only ever return data; the staff member still reviews and saves via the
 * normal Create Query form.
 */
export async function POST(request: NextRequest) {
  const access = await requireChatbotAccess();

  const body = await request.json().catch(() => null);
  const parsed = extractLeadSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: parsed.error.issues[0]!.message }, { status: 400 });
  }

  try {
    const result = await callLLM({
      provider: access.provider,
      apiKey: access.apiKey,
      baseUrl: access.baseUrl,
      model: access.model,
      systemPrompt: EXTRACT_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: parsed.data.text }],
      responseFormatJson: true,
    });

    const raw = JSON.parse(stripJsonFences(result.content ?? '{}'));
    return Response.json({ ok: true, data: sanitize(raw) });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : 'Could not read that.' },
      { status: 500 },
    );
  }
}
