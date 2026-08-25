'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { rateLimit, clientIp } from '@/lib/security/rate-limit';
import { writeAuditLog } from '@/lib/audit';
import { notifyOrgStaff } from '@/lib/notifications/create';
import { DOCUMENT_MAX_BYTES, DOCUMENT_TYPES } from '@/lib/validation/application';

export interface UploadActionState {
  ok: boolean;
  error?: string;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Upload one document to the lead a token resolves to — the public
 * counterpart of uploadLeadDocument() in app/(admin)/leads/actions.ts,
 * gated by document_upload_token + document_upload_expires_at instead of a
 * staff session (see 0033_lead_documents.sql). Parallel to, and separate
 * from, applications' own uploadStudentDocument().
 */
export async function uploadLeadDocumentPublic(
  token: string,
  formData: FormData,
): Promise<UploadActionState> {
  if (!UUID_RE.test(token)) return { ok: false, error: 'Invalid link.' };

  const ip = await clientIp();
  const limited = await rateLimit(`lead-upload:${ip}`, 20, 10 * 60 * 1000);
  if (!limited.success) {
    return { ok: false, error: 'Too many uploads. Please try again shortly.' };
  }

  const service = createServiceClient();
  const { data: lead } = await service
    .from('leads')
    .select('id, organization_id, full_name, document_upload_expires_at')
    .eq('document_upload_token', token)
    .maybeSingle();
  if (!lead) return { ok: false, error: 'This link is invalid.' };
  if (new Date(lead.document_upload_expires_at) < new Date()) {
    return { ok: false, error: 'This link has expired. Please ask your consultant for a new one.' };
  }

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

  const path = `${lead.organization_id}/${lead.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error: uploadErr } = await service.storage
    .from('lead-documents')
    .upload(path, file, { contentType: file.type });
  if (uploadErr) return { ok: false, error: 'Could not upload the file.' };

  const { error: insertErr } = await service.from('lead_documents').insert({
    lead_id: lead.id,
    organization_id: lead.organization_id,
    file_name: file.name,
    storage_path: path,
    file_size: file.size,
    uploaded_by: null,
    uploaded_by_lead: true,
  });
  if (insertErr) return { ok: false, error: 'Could not save the document record.' };

  await writeAuditLog({
    actorId: null,
    organizationId: lead.organization_id,
    action: 'lead_document_uploaded',
    entity: 'lead',
    entityId: lead.id,
    metadata: { file_name: file.name, source: 'lead' },
  });

  // In-app only, no email — same reasoning as applications' document-upload
  // notification: several files in one sitting shouldn't turn into an email
  // burst for something less time-sensitive than a new lead.
  await notifyOrgStaff({
    organizationId: lead.organization_id,
    type: 'lead_document_uploaded',
    title: 'Document uploaded',
    body: `${lead.full_name ?? 'A lead'} uploaded ${file.name}.`,
    link: `/leads/${lead.id}`,
  });

  return { ok: true };
}
