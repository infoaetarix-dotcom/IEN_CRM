'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import {
  step1Schema,
  step2Schema,
  step3Schema,
  normalizeSource,
} from '@/lib/validation/lead';
import { verifyTurnstile } from '@/lib/security/turnstile';
import { rateLimit } from '@/lib/security/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';
import { sendEmail, renderTemplate } from '@/lib/email/brevo';
import { writeAuditLog } from '@/lib/audit';

export interface StepState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  leadId?: string;
  submissionToken?: string;
}

const g = (f: FormData, k: string) => (f.get(k) ?? '') as string;

async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return h.get('x-real-ip') ?? 'unknown';
}

function fieldErrorsFrom(
  issues: { path: (string | number)[]; message: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path[0];
    if (typeof key === 'string' && !out[key]) out[key] = i.message;
  }
  return out;
}

/**
 * STEP 1 — the hook. Creates (or, on back-navigation, updates) a PARTIAL lead
 * so the contact is captured even if the visitor abandons later steps.
 * Hardened like any public write: rate limit + Turnstile + honeypot + Zod.
 */
export async function startLead(
  _prev: StepState,
  formData: FormData,
): Promise<StepState> {
  const existingId = g(formData, 'lead_id');
  const existingToken = g(formData, 'submission_token');
  const isUpdate = !!existingId && !!existingToken;

  // Bot protection only on the first (insert) submission; later edits are
  // gated by the unguessable submission token instead.
  if (!isUpdate) {
    const ip = await clientIp();
    const limited = await rateLimit(`lead:${ip}`, 5, 10 * 60 * 1000);
    if (!limited.success) {
      return { ok: false, error: 'Too many submissions. Please try again shortly.' };
    }
    const token = formData.get('cf-turnstile-response');
    const ok = await verifyTurnstile(
      typeof token === 'string' ? token : null,
      ip === 'unknown' ? undefined : ip,
    );
    if (!ok) {
      return { ok: false, error: 'Bot verification failed. Please refresh and try again.' };
    }
  }

  const parsed = step1Schema.safeParse({
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    target_country: g(formData, 'target_country'),
    consent_given: formData.get('consent_given') === 'on',
    company: g(formData, 'company'),
    utm_source: formData.get('utm_source') ?? undefined,
    utm_medium: formData.get('utm_medium') ?? undefined,
    utm_campaign: formData.get('utm_campaign') ?? undefined,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const d = parsed.data;
  const supabase = createServiceClient();
  const fields = {
    full_name: d.full_name,
    email: d.email,
    phone: d.phone,
    target_country: d.target_country,
    consent_given: d.consent_given,
    consent_at: new Date().toISOString(),
  };

  if (isUpdate) {
    const { error } = await supabase
      .from('leads')
      .update(fields)
      .eq('id', existingId)
      .eq('submission_token', existingToken)
      .eq('is_complete', false);
    if (error) return { ok: false, error: 'Could not save. Please try again.' };
    return { ok: true, leadId: existingId, submissionToken: existingToken };
  }

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      ...fields,
      is_complete: false,
      utm_source: normalizeSource(d.utm_source),
      utm_medium: d.utm_medium || 'direct',
      utm_campaign: d.utm_campaign || null,
    })
    .select('id, submission_token')
    .single();
  if (error || !lead) {
    console.error('[startLead] insert failed', error);
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }

  await writeAuditLog({
    actorId: null,
    action: 'lead_created',
    entity: 'lead',
    entityId: lead.id,
    metadata: { partial: true, source: normalizeSource(d.utm_source) },
  });

  return { ok: true, leadId: lead.id, submissionToken: lead.submission_token };
}

/** STEP 2 — enrich the partial lead with background details. */
export async function saveStep2(
  _prev: StepState,
  formData: FormData,
): Promise<StepState> {
  const leadId = g(formData, 'lead_id');
  const token = g(formData, 'submission_token');
  if (!leadId || !token) {
    return { ok: false, error: 'Your session expired. Please start again.' };
  }

  const parsed = step2Schema.safeParse({
    date_of_birth: formData.get('date_of_birth'),
    city: g(formData, 'city'),
    district: g(formData, 'district'),
    highest_education: g(formData, 'highest_education'),
    last_qualification: g(formData, 'last_qualification'),
    prior_institution: g(formData, 'prior_institution'),
    passing_year: g(formData, 'passing_year'),
    grading_system: g(formData, 'grading_system'),
    grade_value: g(formData, 'grade_value'),
    work_experience_years: g(formData, 'work_experience_years'),
    work_experience_detail: g(formData, 'work_experience_detail'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const d = parsed.data;
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('leads')
    .update({
      date_of_birth: d.date_of_birth,
      city: d.city,
      district: d.district || null,
      highest_education: d.highest_education,
      last_qualification: d.last_qualification,
      prior_institution: d.prior_institution,
      passing_year: d.passing_year,
      grading_system: d.grading_system,
      grade_value: d.grade_value,
      work_experience_years: d.work_experience_years ?? null,
      work_experience_detail: d.work_experience_detail || null,
    })
    .eq('id', leadId)
    .eq('submission_token', token)
    .eq('is_complete', false);
  if (error) return { ok: false, error: 'Could not save. Please try again.' };

  return { ok: true, leadId, submissionToken: token };
}

/** STEP 3 — study goals, mark complete, fire the confirmation email. */
export async function completeLead(
  _prev: StepState,
  formData: FormData,
): Promise<StepState> {
  const leadId = g(formData, 'lead_id');
  const token = g(formData, 'submission_token');
  if (!leadId || !token) {
    return { ok: false, error: 'Your session expired. Please start again.' };
  }

  const parsed = step3Schema.safeParse({
    institution: g(formData, 'institution'),
    program: g(formData, 'program'),
    intake_season: g(formData, 'intake_season'),
    intake_year: g(formData, 'intake_year'),
    english_test: g(formData, 'english_test'),
    english_score: g(formData, 'english_score'),
    funding_source: g(formData, 'funding_source'),
    prior_rejection: formData.get('prior_rejection') === 'on',
    prior_rejection_detail: g(formData, 'prior_rejection_detail'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const d = parsed.data;
  const supabase = createServiceClient();
  const { data: lead, error } = await supabase
    .from('leads')
    .update({
      institution: d.institution || null,
      program: d.program || null,
      intake_season: d.intake_season || null,
      intake_year: d.intake_year ?? null,
      english_test: d.english_test || null,
      english_score: d.english_score ?? null,
      funding_source: d.funding_source || null,
      prior_rejection: d.prior_rejection,
      prior_rejection_detail: d.prior_rejection ? d.prior_rejection_detail || null : null,
      is_complete: true,
    })
    .eq('id', leadId)
    .eq('submission_token', token)
    .eq('is_complete', false)
    .select('id, full_name, email, target_country, program')
    .single();
  if (error || !lead) {
    return { ok: false, error: 'Could not submit. Please try again.' };
  }

  // Confirmation email + audit — best-effort, never block the redirect.
  try {
    const { data: tpl } = await supabase
      .from('email_templates')
      .select('subject, body')
      .eq('key', 'welcome')
      .single();
    if (tpl) {
      const vars = {
        full_name: lead.full_name,
        program: lead.program,
        target_country: lead.target_country,
      };
      await sendEmail({
        leadId: lead.id,
        to: lead.email,
        toName: lead.full_name,
        subject: renderTemplate(tpl.subject, vars),
        body: renderTemplate(tpl.body, vars),
        templateKey: 'welcome',
        sentBy: null,
      });
    }
  } catch (err) {
    console.error('[completeLead] confirmation email failed', err);
  }

  await writeAuditLog({
    actorId: null,
    action: 'lead_created',
    entity: 'lead',
    entityId: lead.id,
    metadata: { completed: true },
  });

  redirect('/thank-you');
}
