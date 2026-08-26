'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireUser } from '@/lib/auth/guards';
import { writeAuditLog } from '@/lib/audit';
import { isLeadStatus, LEAD_SOURCES } from '@/lib/leads/display';
import { leadEditSchema, quickLeadSchema } from '@/lib/validation/lead';
import { sendEmail, renderTemplate } from '@/lib/email/brevo';
import { getDefaultSharedSignature, getSignatureForSend } from '@/lib/email/signatures';
import { notifyOrgStaff } from '@/lib/notifications/create';
import { DOCUMENT_MAX_BYTES, DOCUMENT_TYPES } from '@/lib/validation/application';
import { UPLOAD_LINK_TTL_DAYS } from '@/lib/applications/types';

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
    utm_source: formStr(formData, 'utm_source'),
    reference_name: formStr(formData, 'reference_name'),
    reference_note: formStr(formData, 'reference_note'),
    passport_number: formStr(formData, 'passport_number'),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: 'Please correct the highlighted fields.',
      fieldErrors: fieldErrorsFrom(parsed.error.issues),
    };
  }

  const d = parsed.data;
  // Staff picked this from a closed dropdown (see 0031_reference_lead_sources.sql)
  // rather than an arbitrary public-form UTM param, so it's checked against the
  // real source list directly instead of normalizeSource()'s public-form-only
  // fallback-to-'other' behavior — 'direct' (the column default) if left unset.
  const source =
    d.utm_source && (LEAD_SOURCES as readonly string[]).includes(d.utm_source)
      ? d.utm_source
      : 'direct';
  const service = createServiceClient();
  const { data: lead, error } = await service
    .from('leads')
    .insert({
      ...d,
      consent_at: d.consent_given ? new Date().toISOString() : null,
      organization_id: user.organization_id,
      created_by: user.id,
      is_complete: true,
      utm_source: source,
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
        // Automated template send (same as the public apply wizard's own
        // welcome email), not a staff member composing something — uses
        // the org's default shared signature rather than a personal one.
        const signature = await getDefaultSharedSignature(lead.organization_id);
        await sendEmail({
          leadId: lead.id,
          organizationId: lead.organization_id,
          to: lead.email,
          toName: lead.full_name || lead.email,
          subject: renderTemplate(tpl.subject, vars),
          body: renderTemplate(tpl.body, vars),
          templateKey: 'welcome',
          sentBy: user.id,
          signatureId: signature?.id ?? null,
          signatureHtml: signature?.body_html ?? null,
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

  if (user.organization_id) {
    const { data: lead } = await supabase.from('leads').select('full_name').eq('id', leadId).maybeSingle();
    await notifyOrgStaff({
      organizationId: user.organization_id,
      type: 'note_added',
      title: 'Note added',
      body: `${user.full_name} added a note on ${lead?.full_name || 'a lead'}.`,
      link: `/leads/${leadId}`,
      excludeProfileId: user.id,
    });
  }

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
  signatureId: string | null,
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

  // Re-resolved server-side, never trusted directly from the client — see
  // getSignatureForSend's doc comment for why.
  const signature = signatureId
    ? await getSignatureForSend(lead.organization_id, user.id, signatureId)
    : null;

  const res = await sendEmail({
    leadId: lead.id,
    organizationId: lead.organization_id,
    to: lead.email,
    toName: lead.full_name,
    subject: renderTemplate(tpl.subject, vars),
    body: renderTemplate(tpl.body, vars),
    templateKey,
    sentBy: user.id,
    signatureId: signature?.id ?? null,
    signatureHtml: signature?.body_html ?? null,
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
 * Render a template with this lead's real details — used by the row-level
 * "Email" popup so picking a template fills in human-readable text (the
 * actual name/program, never raw {{full_name}}-style placeholders) into
 * fields the sender can still edit before choosing to send.
 */
export async function getRenderedLeadTemplate(
  leadId: string,
  templateKey: string,
): Promise<{ ok: true; subject: string; body: string } | { ok: false; error: string }> {
  await requireUser();
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from('leads')
    .select('id, organization_id, full_name, target_country, program, institution')
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
  return {
    ok: true,
    subject: renderTemplate(tpl.subject, vars),
    body: renderTemplate(tpl.body, vars),
  };
}

/**
 * Send a fully custom (or template-started, then edited) email from the row
 * -level "Email" popup — unlike sendLeadEmail, the caller supplies the final
 * subject/body directly rather than a template key to render server-side.
 */
export async function sendCustomLeadEmail(
  leadId: string,
  payload: {
    to: string;
    subject: string;
    body: string;
    templateKey: string | null;
    signatureId?: string | null;
  },
): Promise<ActionResult> {
  const user = await requireUser();
  const to = payload.to.trim();
  if (!to) return { ok: false, error: 'Recipient email is required.' };
  if (!payload.subject.trim()) return { ok: false, error: 'Subject is required.' };
  if (!payload.body.trim()) return { ok: false, error: 'Message is required.' };

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from('leads')
    .select('id, organization_id, full_name')
    .eq('id', leadId)
    .single();
  if (!lead) return { ok: false, error: 'Lead not found or access denied.' };

  // Re-resolved server-side, never trusted directly from the client — see
  // getSignatureForSend's doc comment for why.
  const signature = payload.signatureId
    ? await getSignatureForSend(lead.organization_id, user.id, payload.signatureId)
    : null;

  const res = await sendEmail({
    leadId: lead.id,
    organizationId: lead.organization_id,
    to,
    toName: lead.full_name,
    subject: payload.subject,
    body: payload.body,
    templateKey: payload.templateKey,
    sentBy: user.id,
    signatureId: signature?.id ?? null,
    signatureHtml: signature?.body_html ?? null,
  });

  await writeAuditLog({
    actorId: user.id,
    organizationId: lead.organization_id,
    action: res.ok ? 'message_sent' : 'message_failed',
    entity: 'message',
    entityId: res.messageId || null,
    metadata: { leadId, templateKey: payload.templateKey, custom: true, error: res.error },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/leads');
  if (!res.ok) return { ok: false, error: res.error ?? 'Could not send email.' };
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

// ---- Student upload link ----
// A parallel system to applications' own upload link (see
// 0033_lead_documents.sql) — document_upload_token/document_upload_expires_at
// gate the public /upload/lead/[token] page; regenerating rotates both
// together so the old link stops working the instant a new one is issued.

export async function regenerateLeadUploadLink(leadId: string): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: lead } = await supabase
    .from('leads')
    .select('id, organization_id')
    .eq('id', leadId)
    .single();
  if (!lead) return { ok: false, error: 'Lead not found or access denied.' };

  const { error } = await supabase
    .from('leads')
    .update({
      document_upload_token: crypto.randomUUID(),
      document_upload_expires_at: new Date(
        Date.now() + UPLOAD_LINK_TTL_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString(),
    })
    .eq('id', leadId);
  if (error) return { ok: false, error: 'Could not regenerate the link.' };

  await writeAuditLog({
    actorId: user.id,
    organizationId: lead.organization_id,
    action: 'lead_upload_link_regenerated',
    entity: 'lead',
    entityId: leadId,
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/leads');
  return { ok: true };
}

// ---- Documents ----
// Storage is a private bucket with no client-side/authenticated object
// policies at all (see 0033_lead_documents.sql) — every operation on the
// actual file bytes goes through the service role here, gated by
// requireUser() + an RLS-scoped read confirming the lead belongs to the
// caller's org first. The lead_documents row itself uses normal org RLS, so
// it's fine to read/write via the session client.

function sanitizeDocFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
}

async function assertLeadAccess(leadId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('leads')
    .select('id, organization_id')
    .eq('id', leadId)
    .single();
  return data;
}

export async function uploadLeadDocument(
  leadId: string,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const lead = await assertLeadAccess(leadId);
  if (!lead) return { ok: false, error: 'Lead not found or access denied.' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose a file to upload.' };
  }
  if (file.size > DOCUMENT_MAX_BYTES) {
    return { ok: false, error: 'File is too large (10MB max).' };
  }
  if (!(DOCUMENT_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: 'Only PDF, PNG, or JPG files are allowed.' };
  }

  const service = createServiceClient();
  const path = `${lead.organization_id}/${leadId}/${Date.now()}-${sanitizeDocFileName(file.name)}`;
  const { error: uploadErr } = await service.storage
    .from('lead-documents')
    .upload(path, file, { contentType: file.type });
  if (uploadErr) return { ok: false, error: 'Could not upload the file.' };

  const { error: insertErr } = await service.from('lead_documents').insert({
    lead_id: leadId,
    organization_id: lead.organization_id,
    file_name: file.name,
    storage_path: path,
    file_size: file.size,
    uploaded_by: user.id,
  });
  if (insertErr) return { ok: false, error: 'Could not save the document record.' };

  await writeAuditLog({
    actorId: user.id,
    organizationId: lead.organization_id,
    action: 'lead_document_uploaded',
    entity: 'lead',
    entityId: leadId,
    metadata: { file_name: file.name },
  });

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

export async function deleteLeadDocument(documentId: string): Promise<ActionResult> {
  const user = await requireUser();

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from('lead_documents')
    .select('id, lead_id, organization_id, storage_path')
    .eq('id', documentId)
    .single();
  if (!doc) return { ok: false, error: 'Document not found or access denied.' };

  const service = createServiceClient();
  await service.storage.from('lead-documents').remove([doc.storage_path]);
  const { error } = await service.from('lead_documents').delete().eq('id', documentId);
  if (error) return { ok: false, error: 'Could not delete the document.' };

  await writeAuditLog({
    actorId: user.id,
    organizationId: doc.organization_id,
    action: 'lead_document_deleted',
    entity: 'lead',
    entityId: doc.lead_id,
    metadata: { file_name: doc.storage_path },
  });

  revalidatePath(`/leads/${doc.lead_id}`);
  return { ok: true };
}
