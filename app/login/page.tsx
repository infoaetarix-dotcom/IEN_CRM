import { Suspense } from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { LoginForm } from './login-form';
import { AETARIX } from '@/lib/branding';
import { resolveVisitorBrand } from '@/lib/branding/org';
import { resolveTheme } from '@/lib/branding/themes';
import { themeStyleVars } from '@/lib/branding/theme-style';

export async function generateMetadata(): Promise<Metadata> {
  const brand = await resolveVisitorBrand();
  return {
    title: brand ? `Staff sign in — ${brand.name}` : 'Staff sign in — Aetarix CRM',
    icons: brand?.logoUrl ? { icon: brand.logoUrl } : undefined,
  };
}

/**
 * Shared sign-in for every consultancy on the platform. The tenant isn't
 * known until after authentication — so unlike the admin panel, this page
 * can't just read profile.organization_id. On a consultancy's own
 * form_domain/portal_domain, middleware already knows which org that is and
 * forwards it as the x-tenant-slug header; otherwise (the base app domain)
 * it falls back to a "last org" cookie set on a previous successful sign-in
 * (see lib/auth/actions.ts). A first-time visitor on the base domain (no
 * header, no cookie) gets the Aetarix default, same as before.
 */
export default async function LoginPage() {
  const brand = await resolveVisitorBrand();
  const theme = resolveTheme(brand?.themeKey);

  return (
    <main
      style={themeStyleVars(theme.tokens)}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-tenant-navy px-6 py-16"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_50%_0%,rgb(var(--tenant-accent)/0.28),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(248,247,243,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(248,247,243,0.7)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(60%_55%_at_50%_15%,black,transparent)]"
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="mb-6 inline-flex items-center justify-center">
            {brand?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt={brand.name}
                className="h-8 w-auto max-w-[220px] object-contain"
              />
            ) : (
              <Image
                src={AETARIX.wordmark}
                alt={AETARIX.name}
                width={295}
                height={96}
                className="h-8 w-auto object-contain"
              />
            )}
          </Link>
          <h1 className="font-tenant-display text-2xl font-semibold text-tenant-offwhite">
            Staff sign in
          </h1>
          <p className="mt-1 text-sm text-tenant-offwhite/60">
            Sign in to your consultancy&rsquo;s CRM
          </p>
        </div>
        <div className="rounded-xl border border-tenant-ink/10 bg-white p-6 shadow-2xl shadow-black/40">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-tenant-offwhite/40">
          Authorized staff only. All sign-ins are logged.
        </p>
      </div>
    </main>
  );
}
