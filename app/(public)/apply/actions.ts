'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { leadSchema, normalizeSource } from '@/lib/validation/lead';
import { verifyTurnstile } from '@/lib/security/turnstile';
import { rateLimit } from '@/lib/security/rate-limit';
import { createServiceClient } from '@/lib/supabase/service';
import { sendEmail, renderTemplate } from '@/lib/email/brevo';
import { writeAuditLog } from '@/lib/audit';

export interface SubmitState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return h.get('x-real-ip') ?? 'unknown';
}

/**
 * Public form submission. The ONLY unauthenticated write path, so it is
 * hardened: rate limit → Turnstile → honeypot → Zod → service-role insert →
 * confirmation email (logged) → audit → redirect. Errors return a friendly
 * message without leaking internals.
 */
export async function submitLead(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  // 1. Rate limit by IP (5 / 10 min).
  const ip = await clientIp();
  const limited = await rateLimit(`lead:${ip}`, 5, 10 * 60 * 1000);
  if (!limited.success) {
    return {
      ok: false,
      error: 'Too many submissions. Please try again in a few minutes.',
    };
  }

  // 2. Turnstile (verified server-side).
  const token = formData.get('cf-turnstile-response');
  const turnstileOk = await verifyTurnstile(
    typeof token === 'string' ? token : null,
    ip === 'unknown' ? undefined : ip,
  );
  if (!turnstileOk) {
    return {
      ok: false,
      error: 'Bot verification failed. Please refresh and try again.',
    };
  }

  // 3. Honeypot — a filled `company` field means a bot. Pretend success.
  if ((formData.get('company') as string)?.length) {
    redirect('/thank-you');
  }

  // 4. Zod validation (the real boundary — never trust the client).
  const g = (k: string) => formData.get(k) ?? '';
  const raw = {
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    date_of_birth: formData.get('date_of_birth'),
    // Location
    city: g('city'),
    district: g('district'),
    // Study goals
    target_country: g('target_country'),
    institution: g('institution'),
    program: g('program'),
    intake_season: g('intake_season'),
    intake_year: g('intake_year'),
    // Prior education
    highest_education: g('highest_education'),
    last_qualification: g('last_qualification'),
    prior_institution: g('prior_institution'),
    passing_year: g('passing_year'),
    grading_system: g('grading_system'),
    grade_value: g('grade_value'),
    // Experience
    work_experience_years: g('work_experience_years'),
    work_experience_detail: g('work_experience_detail'),
    // English proficiency
    english_test: g('english_test'),
    english_score: g('english_score'),
    // Funding
    funding_source: g('funding_source'),
    prior_rejection: formData.get('prior_rejection') === 'on',
    prior_rejection_detail: formData.get('prior_rejection_detail') ?? '',
    consent_given: formData.get('consent_given') === 'on',
    utm_source: formData.get('utm_source') ?? undefined,
    utm_medium: formData.get('utm_medium') ?? undefined,
    utm_campaign: formData.get('utm_campaign') ?? undefined,
    company: formData.get('company') ?? '',
  };

  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === 'string' && !fieldErrors[key]) {
        fieldErrors[key] = issue.message;
      }
    }
    return {
      ok: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors,
    };
  }

  const d = parsed.data;
  const source = normalizeSource(d.utm_source);
  const supabase = createServiceClient();

  // 5. Insert the lead (service role; browser has no DB write access).
  const { data: lead, error: insertErr } = await supabase
    .from('leads')
    .insert({
      full_name: d.full_name,
      email: d.email,
      phone: d.phone,
      date_of_birth: d.date_of_birth,
      city: d.city || null,
      district: d.district || null,
      target_country: d.target_country || null,
      institution: d.institution || null,
      program: d.program || null,
      intake_season: d.intake_season || null,
      intake_year: d.intake_year ?? null,
      highest_education: d.highest_education || null,
      last_qualification: d.last_qualification || null,
      prior_institution: d.prior_institution || null,
      passing_year: d.passing_year ?? null,
      grading_system: d.grading_system || null,
      grade_value: d.grade_value ?? null,
      work_experience_years: d.work_experience_years ?? null,
      work_experience_detail: d.work_experience_detail || null,
      english_test: d.english_test || null,
      english_score: d.english_score ?? null,
      funding_source: d.funding_source || null,
      prior_rejection: d.prior_rejection,
      prior_rejection_detail: d.prior_rejection ? d.prior_rejection_detail || null : null,
      utm_source: source,
      utm_medium: d.utm_medium || 'direct',
      utm_campaign: d.utm_campaign || null,
      consent_given: d.consent_given,
      consent_at: new Date().toISOString(),
    })
    .select('id, full_name, email, target_country, program')
    .single();

  if (insertErr || !lead) {
    console.error('[submitLead] insert failed', insertErr);
    return {
      ok: false,
      error: 'Something went wrong saving your application. Please try again.',
    };
  }

  // 6. Confirmation email + audit. Best-effort: never block the redirect.
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
        sentBy: null, // system
      });
    }
  } catch (err) {
    console.error('[submitLead] confirmation email failed', err);
  }

  await writeAuditLog({
    actorId: null,
    action: 'lead_created',
    entity: 'lead',
    entityId: lead.id,
    metadata: { source, utm_medium: d.utm_medium || 'direct' },
  });

  // 7. Success. redirect() throws NEXT_REDIRECT — keep it outside try/catch.
  redirect('/thank-you');
}
