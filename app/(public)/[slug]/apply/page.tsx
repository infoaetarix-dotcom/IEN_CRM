import { Suspense } from 'react';
import { LeadForm } from '@/components/form/lead-form';
import { getPublicOrgBrand } from '@/lib/branding/org';
import { resolveTheme } from '@/lib/branding/themes';
import { themeStyleVars } from '@/lib/branding/theme-style';
import { Brandmark } from '@/components/branding/brandmark';
import { PoweredByAetarix } from '@/components/branding/powered-by';

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  const brand = await getPublicOrgBrand(slug);
  return { title: `Start your application — ${brand.legalName}` };
}

export default async function ApplyPage({ params }: { params: Params }) {
  const { slug } = await params;
  const brand = await getPublicOrgBrand(slug);
  const theme = resolveTheme(brand.themeKey);

  return (
    <main
      id="tenant-theme-root"
      style={themeStyleVars(theme.tokens)}
      className="min-h-screen bg-tenant-offwhite"
    >
      {/* Editorial header band */}
      <header className="bg-tenant-navy px-6 py-12 text-tenant-offwhite">
        <div className="mx-auto max-w-2xl">
          <Brandmark brand={brand} size="h-10" onDark className="mb-5" />
          <h1 className="font-tenant-display text-3xl leading-tight sm:text-4xl">
            Start your study-abroad journey
          </h1>
          <p className="mt-3 max-w-lg text-tenant-offwhite/70">
            Share a few details and our consultants will reach out within 24
            hours. It takes about two minutes.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10">
        <Suspense fallback={<p className="text-muted">Loading form…</p>}>
          <LeadForm orgSlug={slug} consentName={brand.legalName} />
        </Suspense>
      </div>

      <footer className="border-t border-line px-6 py-8 text-center text-xs text-muted-foreground">
        <p>
          Your information is handled confidentially and used only to support
          your application.
        </p>
        <div className="mt-4 flex justify-center">
          <PoweredByAetarix />
        </div>
      </footer>
    </main>
  );
}
