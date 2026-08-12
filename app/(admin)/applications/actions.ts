'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireUser } from '@/lib/auth/guards';
import { writeAuditLog } from '@/lib/audit';
import { isLeadStatus } from '@/lib/leads/display';
import {
  applicationEditSchema,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_TYPES,
} from '@/lib/validation/application';
import type { ApplicationFormValues } from '@/lib/applications/types';
import { leadToApplicationDefaults } from '@/lib/applications/types';

export interface ActionState {
  ok: boolean;
  error?: string;
  applicationId?: string;
}

/** Fetch a lead's data pre-shaped as application defaults — used by the create-application dialog once a lead is picked. */
export async function getLeadDefaultsForApplication(
  leadId: string,
): Promise<{ ok: true; values: ApplicationFormValues } | { ok: false; error: string }> {
  await requireUser();
  const supabase = await createClient();
  const { data: lead } = await supabase.from('leads').select('*').eq('id', leadId).single();
  if (!lead) return { ok: false, error: 'Lead not found or access denied.' };
  return { ok: true, values: leadToApplicationDefaults(lead) };
}

const g = (f: FormData, k: string) => (f.get(k) ?? '') as string;

function fieldsFrom(formData: FormData) {
  return {
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
    passport_number: g(formData, 'passport_number'),
    status: g(formData, 'status') || 'new',
  };
}

/**
 * Create an application under a lead. The (possibly-edited) copy of the
 * lead's data arrives already filled into `formData` from the create page —
 * this action doesn't re-read the lead, it just validates and inserts
 * whatever the form has, exactly like `updateLead` does for edits.
 * organization_id comes from the lead itself (read under RLS), never the
 * client, so an application can't be created against another org's lead.
 */
export async function createApplication(
  leadId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = applicationEditSchema.safeParse(fieldsFrom(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]!.message };
  }

  const supabase = await createClient();
  const { data: lead } = await supabase
    .from('leads')
    .select('id, organization_id')
    .eq('id', leadId)
    .single();
  if (!lead) return { ok: false, error: 'Lead not found or access denied.' };

  const insert: Record<string, unknown> = { lead_id: leadId, organization_id: lead.organization_id, created_by: user.id };
  for (const [k, v] of Object.entries(parsed.data)) {
    insert[k] = v === undefined || v === '' ? null : v;
  }

  const { data: application, error } = await supabase
    .from('applications')
    .insert(insert)
    .select('id')
    .single();
  if (error || !application) return { ok: false, error: 'Could not create the application.' };

  await writeAuditLog({
    actorId: user.id,
    organizationId: lead.organization_id,
    action: 'application_created',
    entity: 'application',
    entityId: application.id,
    metadata: { lead_id: leadId },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/applications');
  return { ok: true, applicationId: application.id };
}

export async function updateApplication(
  applicationId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = applicationEditSchema.safeParse(fieldsFrom(formData));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]!.message };
  }

  const update: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    update[k] = v === undefined || v === '' ? null : v;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('applications')
    .update(update)
    .eq('id', applicationId)
    .select('id, lead_id, organization_id')
    .maybeSingle();
  if (error) return { ok: false, error: 'Could not save changes.' };
  if (!data) return { ok: false, error: 'Application not found or access denied.' };

  await writeAuditLog({
    actorId: user.id,
    organizationId: data.organization_id,
    action: 'application_updated',
    entity: 'application',
    entityId: applicationId,
    metadata: { fields: Object.keys(parsed.data) },
  });

  revalidatePath(`/applications/${applicationId}`);
  revalidatePath(`/leads/${data.lead_id}`);
  revalidatePath('/applications');
  return { ok: true };
}

export async function updateApplicationStatus(
  applicationId: string,
  toStatus: string,
): Promise<ActionState> {
  const user = await requireUser();
  if (!isLeadStatus(toStatus)) return { ok: false, error: 'Invalid status.' };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('applications')
    .select('status, lead_id, organization_id')
    .eq('id', applicationId)
    .single();
  if (!existing) return { ok: false, error: 'Application not found or access denied.' };
  if (existing.status === toStatus) return { ok: true };

  const { error } = await supabase
    .from('applications')
    .update({ status: toStatus })
    .eq('id', applicationId);
  if (error) return { ok: false, error: 'Could not update status.' };

  await writeAuditLog({
    actorId: user.id,
    organizationId: existing.organization_id,
    action: 'application_updated',
    entity: 'application',
    entityId: applicationId,
    metadata: { status_from: existing.status, status_to: toStatus },
  });

  revalidatePath(`/applications/${applicationId}`);
  revalidatePath(`/leads/${existing.lead_id}`);
  revalidatePath('/applications');
  return { ok: true };
}

export async function deleteApplication(applicationId: string): Promise<ActionState> {
  const user = await requireUser();

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('applications')
    .select('lead_id, organization_id')
    .eq('id', applicationId)
    .single();
  if (!existing) return { ok: false, error: 'Application not found or access denied.' };

  const { error } = await supabase.from('applications').delete().eq('id', applicationId);
  if (error) return { ok: false, error: 'Could not delete this application.' };

  await writeAuditLog({
    actorId: user.id,
    organizationId: existing.organization_id,
    action: 'application_deleted',
    entity: 'application',
    entityId: applicationId,
  });

  revalidatePath(`/leads/${existing.lead_id}`);
  revalidatePath('/applications');
  return { ok: true };
}

// ---- Documents ----
// Storage is a private bucket with no client-side/authenticated object
// policies at all (see 0022_applications.sql) — every operation on the
// actual file bytes goes through the service role here, gated by requireUser()
// + an RLS-scoped read confirming the application belongs to the caller's org
// first. The application_documents row itself uses normal org RLS, so it's
// fine to read/write via the session client.

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
}

async function assertApplicationAccess(applicationId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('applications')
    .select('id, organization_id, lead_id')
    .eq('id', applicationId)
    .single();
  return data;
}

export async function uploadDocument(
  applicationId: string,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const app = await assertApplicationAccess(applicationId);
  if (!app) return { ok: false, error: 'Application not found or access denied.' };

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
  const path = `${app.organization_id}/${applicationId}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error: uploadErr } = await service.storage
    .from('application-documents')
    .upload(path, file, { contentType: file.type });
  if (uploadErr) return { ok: false, error: 'Could not upload the file.' };

  const { error: insertErr } = await service.from('application_documents').insert({
    application_id: applicationId,
    organization_id: app.organization_id,
    file_name: file.name,
    storage_path: path,
    file_size: file.size,
    uploaded_by: user.id,
  });
  if (insertErr) return { ok: false, error: 'Could not save the document record.' };

  await writeAuditLog({
    actorId: user.id,
    organizationId: app.organization_id,
    action: 'application_document_uploaded',
    entity: 'application',
    entityId: applicationId,
    metadata: { file_name: file.name },
  });

  revalidatePath(`/applications/${applicationId}`);
  return { ok: true };
}

export async function replaceDocument(
  documentId: string,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from('application_documents')
    .select('id, application_id, organization_id, storage_path')
    .eq('id', documentId)
    .single();
  if (!doc) return { ok: false, error: 'Document not found or access denied.' };

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
  await service.storage.from('application-documents').remove([doc.storage_path]);
  const newPath = `${doc.organization_id}/${doc.application_id}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error: uploadErr } = await service.storage
    .from('application-documents')
    .upload(newPath, file, { contentType: file.type });
  if (uploadErr) return { ok: false, error: 'Could not upload the replacement file.' };

  const { error: updateErr } = await service
    .from('application_documents')
    .update({ file_name: file.name, storage_path: newPath, file_size: file.size, uploaded_by: user.id })
    .eq('id', documentId);
  if (updateErr) return { ok: false, error: 'Could not update the document record.' };

  await writeAuditLog({
    actorId: user.id,
    organizationId: doc.organization_id,
    action: 'application_document_replaced',
    entity: 'application',
    entityId: doc.application_id,
    metadata: { file_name: file.name },
  });

  revalidatePath(`/applications/${doc.application_id}`);
  return { ok: true };
}

export async function deleteDocument(documentId: string): Promise<ActionState> {
  const user = await requireUser();

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from('application_documents')
    .select('id, application_id, organization_id, storage_path')
    .eq('id', documentId)
    .single();
  if (!doc) return { ok: false, error: 'Document not found or access denied.' };

  const service = createServiceClient();
  await service.storage.from('application-documents').remove([doc.storage_path]);
  const { error } = await service.from('application_documents').delete().eq('id', documentId);
  if (error) return { ok: false, error: 'Could not delete the document.' };

  await writeAuditLog({
    actorId: user.id,
    organizationId: doc.organization_id,
    action: 'application_document_deleted',
    entity: 'application',
    entityId: doc.application_id,
    metadata: { file_name: doc.storage_path },
  });

  revalidatePath(`/applications/${doc.application_id}`);
  return { ok: true };
}

const noteSchema = z.string().trim().min(1, 'Note cannot be empty').max(2000);

/** Append a note. RLS (application_notes_insert) enforces author + org access — same pattern as lead notes. */
export async function addApplicationNote(
  applicationId: string,
  body: string,
): Promise<ActionState> {
  const user = await requireUser();
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const supabase = await createClient();
  const { error } = await supabase.from('application_notes').insert({
    application_id: applicationId,
    organization_id: user.organization_id,
    author_id: user.id,
    body: parsed.data,
  });
  if (error) return { ok: false, error: 'Could not add note (access denied?).' };

  await writeAuditLog({
    actorId: user.id,
    organizationId: user.organization_id,
    action: 'note_added',
    entity: 'application',
    entityId: applicationId,
  });

  revalidatePath(`/applications/${applicationId}`);
  return { ok: true };
}
