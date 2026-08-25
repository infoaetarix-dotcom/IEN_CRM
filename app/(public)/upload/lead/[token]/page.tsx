import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/service';
import { getLeadUploadContext } from '@/lib/leads/upload-link';
import { brandFromOrg, FALLBACK_BRAND } from '@/lib/branding';
import { resolveTheme } from '@/lib/branding/themes';
import { themeStyleVars } from '@/lib/branding/theme-style';
import { Brandmark } from '@/components/branding/brandmark';
import { PoweredByAetarix } from '@/components/branding/powered-by';
import { LeadUploadForm } from '@/components/public/lead-upload-form';

type Params = Promise<{ token: string }>;

/**
 * Public, unauthenticated page reached only via an unguessable
 * document_upload_token (see 0033_lead_documents.sql) — a fully separate
 * route from /upload/[token] (applications) rather than a shared one
 * branching on entity type, so the already-verified applications flow can't
 * regress from changes made here.
 */
export async function generateMetadata({ params }: { params: Params }) {
  const { token } = await params;
  const lead = await getLeadUploadContext(token);
  const orgRow = lead
    ? Array.isArray(lead.organizations)
      ? lead.organizations[0]
      : lead.organizations
    : null;
  const brand = orgRow ? brandFromOrg(orgRow) : FALLBACK_BRAND;
  return {
    title: `Upload your documents — ${brand.legalName}`,
    icons: brand.logoUrl ? { icon: brand.logoUrl } : undefined,
  };
}

export default async function LeadUploadPage({ params }: { params: Params }) {
  const { token } = await params;
  const lead = await getLeadUploadContext(token);
  if (!lead) notFound();

  const orgRow = Array.isArray(lead.organizations) ? lead.organizations[0] : lead.organizations;
  const brand = orgRow ? brandFromOrg(orgRow) : FALLBACK_BRAND;
  const theme = resolveTheme(brand.themeKey);
  const expired = new Date(lead.document_upload_expires_at) < new Date();

  const service = createServiceClient();
  const { data: documents } = await service
    .from('lead_documents')
    .select('id, file_name, created_at')
    .eq('lead_id', lead.id)
    .order('created_at', { ascending: false });

  return (
    <main
      id="tenant-theme-root"
      style={themeStyleVars(theme.tokens)}
      className="min-h-screen bg-tenant-offwhite"
    >
      <header className="relative overflow-hidden bg-tenant-navy px-4 py-12 text-tenant-offwhite sm:px-6 sm:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_50%_0%,rgb(var(--tenant-accent)/0.28),transparent_70%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(248,247,243,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(248,247,243,0.7)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(60%_55%_at_50%_15%,black,transparent)]"
        />

        <div className="relative mx-auto max-w-2xl">
          <Brandmark brand={brand} size="h-9 sm:h-10" className="mb-6" />
          <p className="label-eyebrow text-tenant-accent2">Document upload</p>
          <h1 className="mt-2 break-words font-tenant-display text-2xl leading-tight sm:text-3xl md:text-4xl">
            {lead.full_name ? `Hi ${lead.full_name}, upload your documents` : 'Upload your documents'}
          </h1>
          <p className="mt-3 max-w-lg text-sm text-tenant-offwhite/70 sm:text-base">
            For your enquiry with {brand.name}.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        {expired ? (
          <div className="rounded-lg border border-tenant-ink/10 bg-white p-6 text-center">
            <p className="text-sm font-medium text-tenant-ink">This link has expired.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Please contact your consultant for a new upload link.
            </p>
          </div>
        ) : (
          <LeadUploadForm token={token} initialDocuments={documents ?? []} />
        )}
      </div>

      <footer className="border-t border-line px-4 py-8 text-center sm:px-6">
        <p className="mx-auto max-w-md text-xs text-muted-foreground">
          Your files are shared privately with {brand.name} and used only to process your
          enquiry.
        </p>
        <div className="mt-4 flex justify-center">
          <PoweredByAetarix />
        </div>
      </footer>
    </main>
  );
}
