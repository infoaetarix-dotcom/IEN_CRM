import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { getPublicOrgBrand } from '@/lib/branding/org';
import { FALLBACK_BRAND } from '@/lib/branding';
import { resolveTheme } from '@/lib/branding/themes';
import { themeStyleVars } from '@/lib/branding/theme-style';

export const metadata = {
  title: 'Application received',
};

type SearchParams = Promise<{ org?: string }>;

export default async function ThankYouPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { org } = await searchParams;
  const brand = org ? await getPublicOrgBrand(org) : FALLBACK_BRAND;
  const theme = resolveTheme(brand.themeKey);

  return (
    <main
      id="tenant-theme-root"
      style={themeStyleVars(theme.tokens)}
      className="flex min-h-screen flex-col items-center justify-center bg-tenant-navy px-6 text-center text-tenant-offwhite"
    >
      <CheckCircle2 className="h-14 w-14 text-tenant-accent" />
      <p className="label-eyebrow mt-6 text-tenant-accent">Application received</p>
      <h1 className="mt-3 max-w-xl font-tenant-display text-3xl leading-tight sm:text-4xl">
        Thank you — we&apos;ve got your details.
      </h1>
      <p className="mt-4 max-w-md text-tenant-offwhite/70">
        A confirmation email is on its way. One of our consultants will reach
        out within 24 hours to discuss your study-abroad plans.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-md border border-tenant-offwhite/30 px-6 py-3 text-sm font-medium text-tenant-offwhite transition hover:bg-tenant-offwhite/10"
      >
        Back to home
      </Link>
    </main>
  );
}
