'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { rateLimit, clientIp } from '@/lib/security/rate-limit';
import { writeAuditLog } from '@/lib/audit';
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
 * Upload one document to the application a token resolves to — the public
 * counterpart of uploadDocument() in app/(admin)/applications/actions.ts,
 * gated by document_upload_token + document_upload_expires_at instead of a
 * staff session (same substitution leads.submission_token makes for
 * anonymous public writes — see 0029_application_upload_link.sql).
 */
export async function uploadStudentDocument(
  token: string,
  formData: FormData,
): Promise<UploadActionState> {
  if (!UUID_RE.test(token)) return { ok: false, error: 'Invalid link.' };

  const ip = await clientIp();
  const limited = await rateLimit(`student-upload:${ip}`, 20, 10 * 60 * 1000);
  if (!limited.success) {
    return { ok: false, error: 'Too many uploads. Please try again shortly.' };
  }

  const service = createServiceClient();
  const { data: app } = await service
    .from('applications')
    .select('id, organization_id, document_upload_expires_at')
    .eq('document_upload_token', token)
    .maybeSingle();
  if (!app) return { ok: false, error: 'This link is invalid.' };
  if (new Date(app.document_upload_expires_at) < new Date()) {
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

  const path = `${app.organization_id}/${app.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
  const { error: uploadErr } = await service.storage
    .from('application-documents')
    .upload(path, file, { contentType: file.type });
  if (uploadErr) return { ok: false, error: 'Could not upload the file.' };

  const { error: insertErr } = await service.from('application_documents').insert({
    application_id: app.id,
    organization_id: app.organization_id,
    file_name: file.name,
    storage_path: path,
    file_size: file.size,
    uploaded_by: null,
    uploaded_by_student: true,
  });
  if (insertErr) return { ok: false, error: 'Could not save the document record.' };

  await writeAuditLog({
    actorId: null,
    organizationId: app.organization_id,
    action: 'application_document_uploaded',
    entity: 'application',
    entityId: app.id,
    metadata: { file_name: file.name, source: 'student' },
  });

  return { ok: true };
}
