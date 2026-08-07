'use server';

import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/auth/guards';
import { createServiceClient } from '@/lib/supabase/service';
import { quickLeadSchema, normalizeSource } from '@/lib/validation/lead';
import { sendEmail, renderTemplate } from '@/lib/email/brevo';
import { writeAuditLog } from '@/lib/audit';

export interface CreateQueryState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  leadId?: string;
}

const g = (f: FormData, k: string) => (f.get(k) ?? '') as string;

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
 * Single-page, single-save version of lead creation for staff (a query taken
 * over the phone or in person) — unlike the public wizard, nothing here is
 * required; whatever the staff member has is saved. organization_id and
 * created_by come from the session, never the client. Needs the service role
 * because leads has no authenticated insert policy (the public wizard is
 * otherwise the only writer).
 */
export async function createQuery(
  _prev: CreateQueryState,
  formData: FormData,
): Promise<CreateQueryState> {
  const user = await requireUser();

  const parsed = quickLeadSchema.safeParse({
    full_name: g(formData, 'full_name'),
    email: g(formData, 'email'),
    phone: g(formData, 'phone'),
    date_of_birth: g(formData, 'date_of_birth'),
    city: g(formData, 'city'),
    district: g(formData, 'district'),
    target_country: g(formData, 'target_country'),
    institution: g(formData, 'institution'),
    program: g(formData, 'program'),
    intake_season: g(formData, 'intake_season'),
    intake_year: g(formData, 'intake_year'),
    highest_education: g(formData, 'highest_education'),
    last_qualification: g(formData, 'last_qualification'),
    prior_institution: g(formData, 'prior_institution'),
    passing_year: g(formData, 'passing_year'),
    grading_system: g(formData, 'grading_system'),
    grade_value: g(formData, 'grade_value'),
    work_experience_years: g(formData, 'work_experience_years'),
    work_experience_detail: g(formData, 'work_experience_detail'),
    english_test: g(formData, 'english_test'),
    english_score: g(formData, 'english_score'),
    funding_source: g(formData, 'funding_source'),
    prior_rejection: formData.get('prior_rejection') === 'on',
    prior_rejection_detail: g(formData, 'prior_rejection_detail'),
    consent_given: formData.get('consent_given') === 'on',
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const d = parsed.data;
  const service = createServiceClient();
  const { data: lead, error } = await service
    .from('leads')
    .insert({
      ...d,
      consent_at: d.consent_given ? new Date().toISOString() : null,
      organization_id: user.organization_id,
      created_by: user.id,
      is_complete: true,
      utm_source: normalizeSource(undefined),
    })
    .select('id, email, full_name, target_country, program, organization_id')
    .single();
  if (error || !lead) {
    console.error('[createQuery] insert failed', error);
    return { ok: false, error: 'Something went wrong. Please try again.' };
  }

  // Confirmation email — only if we actually have an address to send to.
  if (lead.email) {
    try {
      const { data: tpl } = await service
        .from('email_templates')
        .select('subject, body')
        .eq('organization_id', lead.organization_id)
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
          organizationId: lead.organization_id,
          to: lead.email,
          toName: lead.full_name || lead.email,
          subject: renderTemplate(tpl.subject, vars),
          body: renderTemplate(tpl.body, vars),
          templateKey: 'welcome',
          sentBy: user.id,
        });
      }
    } catch (err) {
      console.error('[createQuery] confirmation email failed', err);
    }
  }

  await writeAuditLog({
    actorId: user.id,
    organizationId: user.organization_id,
    action: 'lead_created',
    entity: 'lead',
    entityId: lead.id,
    metadata: { via: 'staff-quick' },
  });

  revalidatePath('/leads');
  return { ok: true, leadId: lead.id };
}
