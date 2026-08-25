import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

// Signed URL for a private-bucket document. RLS on lead_documents already
// scopes the row read to the caller's own org; the service role is only
// used afterward, to mint the URL itself (the bucket has no object policies
// at all — see 0033_lead_documents.sql).
const SIGNED_URL_TTL_SECONDS = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireUser();
  const { id } = await params;

  const supabase = await createClient();
  const { data: doc } = await supabase
    .from('lead_documents')
    .select('storage_path, file_name')
    .eq('id', id)
    .single();
  if (!doc) return new Response('Not found', { status: 404 });

  const service = createServiceClient();
  const { data, error } = await service.storage
    .from('lead-documents')
    .createSignedUrl(doc.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: doc.file_name,
    });
  if (error || !data) return new Response('Could not access this file.', { status: 500 });

  return NextResponse.redirect(data.signedUrl);
}
