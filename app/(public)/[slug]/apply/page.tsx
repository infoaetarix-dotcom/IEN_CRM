import { Suspense } from 'react';
import { ShieldCheck, Clock3, Sparkles } from 'lucide-react';
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
  return {
    title: `Start your application — ${brand.legalName}`,
    icons: brand.logoUrl ? { icon: brand.logoUrl } : undefined,
  };
}

const TRUST_POINTS = [
  { icon: Clock3, label: 'Reply within 24 hours' },
  { icon: ShieldCheck, label: 'Your details stay confidential' },
  { icon: Sparkles, label: 'Free initial consultation' },
];

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
      {/* Editorial header band — same dynamic-glow treatment as the staff login page,
          so the tenant's theme reads consistently across every public-facing surface. */}
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
          <p className="label-eyebrow text-tenant-accent2">Application form</p>
          <h1 className="mt-2 break-words font-tenant-display text-2xl leading-tight sm:text-3xl md:text-4xl">
            Start your study-abroad journey with {brand.name}
          </h1>
          <p className="mt-3 max-w-lg text-sm text-tenant-offwhite/70 sm:text-base">
            Share a few details and our consultants will reach out to guide
            you — it takes about two minutes.
          </p>

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
            {TRUST_POINTS.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-1.5 text-xs text-tenant-offwhite/70 sm:text-sm"
              >
                <Icon className="h-4 w-4 shrink-0 text-tenant-accent2" />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <Suspense fallback={<p className="text-muted-foreground">Loading form…</p>}>
          <LeadForm orgSlug={slug} consentName={brand.legalName} />
        </Suspense>
      </div>

      <footer className="border-t border-line px-4 py-8 text-center sm:px-6">
        <p className="mx-auto max-w-md text-xs text-muted-foreground">
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
