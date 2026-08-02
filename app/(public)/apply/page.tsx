import { Suspense } from 'react';
import { LeadForm } from './lead-form';
import { getPublicOrgBrand } from '@/lib/branding/org';
import { Brandmark } from '@/components/branding/brandmark';
import { PoweredByAetarix } from '@/components/branding/powered-by';

// Tenant for the bare /apply route. Phase D adds per-consultancy /{slug}/apply.
const DEFAULT_ORG_SLUG = 'ien';

export async function generateMetadata() {
  const brand = await getPublicOrgBrand(DEFAULT_ORG_SLUG);
  return { title: `Start your application — ${brand.legalName}` };
}

export default async function ApplyPage() {
  const brand = await getPublicOrgBrand(DEFAULT_ORG_SLUG);

  return (
    <main className="min-h-screen bg-cream">
      {/* Editorial header band */}
      <header className="bg-navy px-6 py-12 text-paper">
        <div className="mx-auto max-w-2xl">
          <Brandmark brand={brand} size="h-10" onDark className="mb-5" />
          <h1 className="font-serif text-3xl leading-tight sm:text-4xl">
            Start your study-abroad journey
          </h1>
          <p className="mt-3 max-w-lg text-muted">
            Share a few details and our consultants will reach out within 24
            hours. It takes about two minutes.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10">
        <Suspense fallback={<p className="text-muted">Loading form…</p>}>
          <LeadForm consentName={brand.legalName} />
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
