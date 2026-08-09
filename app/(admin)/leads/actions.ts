'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireUser } from '@/lib/auth/guards';
import { writeAuditLog } from '@/lib/audit';
import { isLeadStatus } from '@/lib/leads/display';
import { leadEditSchema, quickLeadSchema, normalizeSource } from '@/lib/validation/lead';
import { sendEmail, renderTemplate } from '@/lib/email/brevo';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface CreateQueryState {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  leadId?: string;
}

const formStr = (f: FormData, k: string) => (f.get(k) ?? '') as string;

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
 * over the phone or in person, via the "Create query" dialog on /leads) —
 * unlike the public wizard, nothing here is required; whatever the staff
 * member has is saved. organization_id and created_by come from the session,
 * never the client. Needs the service role because leads has no
 * authenticated insert policy (the public wizard is otherwise the only
 * writer).
 */
export async function createQuery(
  _prev: CreateQueryState,
  formData: FormData,
): Promise<CreateQueryState> {
  const user = await requireUser();

  const parsed = quickLeadSchema.safeParse({
    full_name: formStr(formData, 'full_name'),
    email: formStr(formData, 'email'),
    phone: formStr(formData, 'phone'),
    date_of_birth: formStr(formData, 'date_of_birth'),
    city: formStr(formData, 'city'),
    district: formStr(formData, 'district'),
    target_country: formStr(formData, 'target_country'),
    institution: formStr(formData, 'institution'),
    program: formStr(formData, 'program'),
    intake_season: formStr(formData, 'intake_season'),
    intake_year: formStr(formData, 'intake_year'),
    highest_education: formStr(formData, 'highest_education'),
    last_qualification: formStr(formData, 'last_qualification'),
    prior_institution: formStr(formData, 'prior_institution'),
    passing_year: formStr(formData, 'passing_year'),
    grading_system: formStr(formData, 'grading_system'),
    grade_value: formStr(formData, 'grade_value'),
    work_experience_years: formStr(formData, 'work_experience_years'),
    work_experience_detail: formStr(formData, 'work_experience_detail'),
    english_test: formStr(formData, 'english_test'),
    english_score: formStr(formData, 'english_score'),
    funding_source: formStr(formData, 'funding_source'),
    prior_rejection: formData.get('prior_rejection') === 'on',
    prior_rejection_detail: formStr(formData, 'prior_rejection_detail'),
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

/**
 * Change a lead's status. The user-session client performs the update so RLS
 * gates access (admin OR assigned agent). History + audit are written with the
 * service role afterwards — only once the gated update has succeeded.
 */
export async function updateLeadStatus(
  leadId: string,
  toStatus: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!isLeadStatus(toStatus)) return { ok: false, error: 'Invalid status.' };

  const supabase = await createClient();

  // Read current status under RLS — null means no access / not found.
  const { data: existing } = await supabase
    .from('leads')
    .select('status, organization_id')
    .eq('id', leadId)
    .single();
  if (!existing) return { ok: false, error: 'Lead not found or access denied.' };
  if (existing.status === toStatus) return { ok: true };

  const { error: updErr } = await supabase
    .from('leads')
    .update({ status: toStatus })
    .eq('id', leadId);
  if (updErr) return { ok: false, error: 'Could not update status.' };

  // History + audit (service role; tables have no end-user insert policy).
  const service = createServiceClient();
  await service.from('lead_status_history').insert({
    lead_id: leadId,
    organization_id: existing.organization_id,
    from_status: existing.status,
    to_status: toStatus,
    changed_by: user.id,
  });
  await writeAuditLog({
    actorId: user.id,
    organizationId: existing.organization_id,
    action: 'status_change',
    entity: 'lead',
    entityId: leadId,
    metadata: { from: existing.status, to: toStatus },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/leads');
  return { ok: true };
}

const noteSchema = z.string().trim().min(1, 'Note cannot be empty').max(2000);

/** Append a note. RLS (notes_insert) enforces author + lead access. */
export async function addNote(
  leadId: string,
  body: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const supabase = await createClient();
  const { error } = await supabase.from('lead_notes').insert({
    lead_id: leadId,
    organization_id: user.organization_id,
    author_id: user.id,
    body: parsed.data,
  });
  if (error) return { ok: false, error: 'Could not add note (access denied?).' };

  await writeAuditLog({
    actorId: user.id,
    organizationId: user.organization_id,
    action: 'note_added',
    entity: 'lead',
    entityId: leadId,
  });

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

/**
 * Send a templated email from a lead's profile (Phase 3 UI uses this).
 * Verifies lead access via RLS, renders from the allow-list, logs + audits.
 */
export async function sendLeadEmail(
  leadId: string,
  templateKey: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from('leads')
    .select('id, organization_id, full_name, email, target_country, program, institution')
    .eq('id', leadId)
    .single();
  if (!lead) return { ok: false, error: 'Lead not found or access denied.' };

  const { data: tpl } = await supabase
    .from('email_templates')
    .select('subject, body')
    .eq('organization_id', lead.organization_id)
    .eq('key', templateKey)
    .single();
  if (!tpl) return { ok: false, error: 'Template not found.' };

  const vars = {
    full_name: lead.full_name,
    program: lead.program,
    target_country: lead.target_country,
    institution: lead.institution,
  };

  const res = await sendEmail({
    leadId: lead.id,
    organizationId: lead.organization_id,
    to: lead.email,
    toName: lead.full_name,
    subject: renderTemplate(tpl.subject, vars),
    body: renderTemplate(tpl.body, vars),
    templateKey,
    sentBy: user.id,
  });

  await writeAuditLog({
    actorId: user.id,
    organizationId: lead.organization_id,
    action: res.ok ? 'message_sent' : 'message_failed',
    entity: 'message',
    entityId: res.messageId || null,
    metadata: { leadId, templateKey, error: res.error },
  });

  revalidatePath(`/leads/${leadId}`);
  if (!res.ok) return { ok: false, error: res.error ?? 'Send failed.' };
  return { ok: true };
}

/**
 * Update a lead's applicant-provided fields from the dashboard editor.
 * Access is enforced by RLS (leads_update: admin OR the assigned agent, within
 * org) — the update runs on the user-session client, so a non-permitted edit
 * touches zero rows and is reported as access denied. Re-validates every field
 * with the same rules the public form uses.
 */
export async function updateLead(
  leadId: string,
  values: unknown,
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = leadEditSchema.safeParse(values);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]!.message };
  }

  // Cleared optional fields must persist as NULL. Empty strings are treated as
  // "cleared" too — the DB CHECK constraints on coded columns (english_test,
  // intake_season, funding_source, …) allow NULL or an enum value, never ''.
  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    update[k] = v === undefined || v === '' ? null : v;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('leads')
    .update(update)
    .eq('id', leadId)
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: 'Could not save changes.' };
  if (!data) return { ok: false, error: 'Lead not found or access denied.' };

  await writeAuditLog({
    actorId: user.id,
    organizationId: user.organization_id,
    action: 'lead_updated',
    entity: 'lead',
    entityId: leadId,
    metadata: { fields: Object.keys(parsed.data) },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/leads');
  return { ok: true };
}

/**
 * Archive a lead (soft delete). RLS (leads_update) allows admin OR the assigned
 * agent; `archived_by` records who did it for the admin's accountability trail.
 * Only acts on currently-active leads.
 */
export async function archiveLead(leadId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('leads')
    .update({ archived_at: new Date().toISOString(), archived_by: user.id })
    .eq('id', leadId)
    .is('archived_at', null)
    .select('id, organization_id')
    .maybeSingle();
  if (error) return { ok: false, error: 'Could not archive lead.' };
  if (!data) return { ok: false, error: 'Lead not found or access denied.' };

  await writeAuditLog({
    actorId: user.id,
    organizationId: data.organization_id,
    action: 'lead_archived',
    entity: 'lead',
    entityId: leadId,
  });

  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

/** Restore an archived lead. RLS allows admin OR the assigned agent. */
export async function unarchiveLead(leadId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('leads')
    .update({ archived_at: null, archived_by: null })
    .eq('id', leadId)
    .select('id, organization_id')
    .maybeSingle();
  if (error) return { ok: false, error: 'Could not restore lead.' };
  if (!data) return { ok: false, error: 'Lead not found or access denied.' };

  await writeAuditLog({
    actorId: user.id,
    organizationId: data.organization_id,
    action: 'lead_unarchived',
    entity: 'lead',
    entityId: leadId,
  });

  revalidatePath('/leads');
  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

/**
 * Duplicate a lead's full data into a new row (fresh id + lead_number).
 * The read is RLS-gated on the session client, same as every other action
 * here; the insert runs on the service role because `leads` has no
 * authenticated insert policy (the public wizard is the only client-side
 * insert path — see startLead). organization_id comes from the fetched row,
 * which RLS already guaranteed belongs to the caller's org, not from any
 * client input.
 */
export async function copyLead(
  leadId: string,
): Promise<ActionResult & { newLeadId?: string }> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: source, error: fetchErr } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();
  if (fetchErr || !source) return { ok: false, error: 'Lead not found or access denied.' };

  const {
    id: _id,
    lead_number: _leadNumber,
    created_at: _createdAt,
    updated_at: _updatedAt,
    archived_at: _archivedAt,
    archived_by: _archivedBy,
    submission_token: _submissionToken,
    ...copyable
  } = source;

  const service = createServiceClient();
  const { data: created, error: insertErr } = await service
    .from('leads')
    .insert(copyable)
    .select('id')
    .single();
  if (insertErr || !created) return { ok: false, error: 'Could not copy lead.' };

  await writeAuditLog({
    actorId: user.id,
    organizationId: source.organization_id,
    action: 'lead_copied',
    entity: 'lead',
    entityId: created.id,
    metadata: { copied_from: leadId },
  });

  revalidatePath('/leads');
  return { ok: true, newLeadId: created.id };
}

/**
 * Permanently delete a lead. Any active org member may delete any lead in
 * their org (shared-data model — see leads_delete RLS). Notes / status
 * history / messages cascade automatically (FK ON DELETE CASCADE). The audit
 * row is written FIRST, before the lead is gone, so the deletion trail
 * survives (audit_log does not cascade). Unrecoverable — the UI must confirm
 * before calling this.
 */
export async function deleteLead(leadId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from('leads')
    .select('id, organization_id, full_name, email')
    .eq('id', leadId)
    .single();
  if (!lead) return { ok: false, error: 'Lead not found or access denied.' };

  await writeAuditLog({
    actorId: user.id,
    organizationId: lead.organization_id,
    action: 'lead_deleted',
    entity: 'lead',
    entityId: leadId,
    metadata: { full_name: lead.full_name, email: lead.email },
  });

  const { error } = await supabase.from('leads').delete().eq('id', leadId);
  if (error) return { ok: false, error: 'Could not delete lead.' };

  revalidatePath('/leads');
  return { ok: true };
}
