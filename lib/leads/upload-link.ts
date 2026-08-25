import 'server-only';

import { cache } from 'react';
import { createServiceClient } from '@/lib/supabase/service';

export const UPLOAD_TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolves a document_upload_token to its lead + org context — memoized per
 * request (React cache()) so generateMetadata and the page body share one
 * query instead of hitting the service role twice for the same render, same
 * pattern as applications' getUploadContext (lib/applications/upload-link.ts).
 */
export const getLeadUploadContext = cache(async (token: string) => {
  if (!UPLOAD_TOKEN_RE.test(token)) return null;
  const service = createServiceClient();
  const { data } = await service
    .from('leads')
    .select(
      'id, full_name, document_upload_expires_at, organizations(name, legal_name, logo_url, theme_key)',
    )
    .eq('document_upload_token', token)
    .maybeSingle();
  return data;
});
