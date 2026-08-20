import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/service';
import { brandFromOrg, FALLBACK_BRAND } from '@/lib/branding';
import { resolveTheme } from '@/lib/branding/themes';
import { themeStyleVars } from '@/lib/branding/theme-style';
import { Brandmark } from '@/components/branding/brandmark';
import { PoweredByAetarix } from '@/components/branding/powered-by';
import { StudentUploadForm } from '@/components/public/student-upload-form';

type Params = Promise<{ token: string }>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const metadata = { title: 'Upload your documents' };

/**
 * Public, unauthenticated page reached only via an unguessable
 * document_upload_token (see 0029_application_upload_link.sql) — the token
 * alone resolves exactly one application, no login, no other application
 * data exposed beyond the applicant's name and target university (context
 * for a friendly header). Branded dynamically per-org, same mechanism as
 * the public apply form (app/(public)/[slug]/apply/page.tsx).
 */
export default async function UploadPage({ params }: { params: Params }) {
  const { token } = await params;
  if (!UUID_RE.test(token)) notFound();

  const service = createServiceClient();
  const { data: app } = await service
    .from('applications')
    .select(
      'id, full_name, document_upload_expires_at, organizations(name, legal_name, logo_url, theme_key), universities(name, country)',
    )
    .eq('document_upload_token', token)
    .maybeSingle();
  if (!app) notFound();

  const orgRow = Array.isArray(app.organizations) ? app.organizations[0] : app.organizations;
  const university = Array.isArray(app.universities) ? app.universities[0] : app.universities;
  const brand = orgRow ? brandFromOrg(orgRow) : FALLBACK_BRAND;
  const theme = resolveTheme(brand.themeKey);
  const expired = new Date(app.document_upload_expires_at) < new Date();

  const { data: documents } = await service
    .from('application_documents')
    .select('id, file_name, created_at')
    .eq('application_id', app.id)
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
            {app.full_name ? `Hi ${app.full_name}, upload your documents` : 'Upload your documents'}
          </h1>
          <p className="mt-3 max-w-lg text-sm text-tenant-offwhite/70 sm:text-base">
            {university
              ? `For your application to ${university.name}${university.country ? ` (${university.country})` : ''} with ${brand.name}.`
              : `For your application with ${brand.name}.`}
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
          <StudentUploadForm token={token} initialDocuments={documents ?? []} />
        )}
      </div>

      <footer className="border-t border-line px-4 py-8 text-center sm:px-6">
        <p className="mx-auto max-w-md text-xs text-muted-foreground">
          Your files are shared privately with {brand.name} and used only to process your
          application.
        </p>
        <div className="mt-4 flex justify-center">
          <PoweredByAetarix />
        </div>
      </footer>
    </main>
  );
}
