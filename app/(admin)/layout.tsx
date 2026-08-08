import Link from 'next/link';
import Image from 'next/image';
import { redirect } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import { getOrgBrand } from '@/lib/branding/org';
import { resolveTheme } from '@/lib/branding/themes';
import { themeStyleVars } from '@/lib/branding/theme-style';
import { AETARIX, initialsFrom } from '@/lib/branding';
import { Sidebar } from '@/components/dashboard/sidebar';
import { SignOutButton } from '@/components/dashboard/sign-out-button';
import { Badge } from '@/components/ui/badge';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Guard: redirects to /login if unauthenticated/inactive. RLS is the backstop.
  const profile = await requireUser();

  // The org CRM belongs to tenant staff. Super admins have cross-org RLS access,
  // so without this they'd land here and see every consultancy's leads merged
  // into one dashboard — their console is /super. (Covers direct navigation and
  // the middleware bounce from /login, which can't read the flag itself.)
  if (profile.is_super_admin) redirect('/super');

  // New staff must set their own password before using the CRM. The
  // /change-password page lives outside this layout, so there's no redirect loop.
  if (profile.must_change_password) redirect('/change-password');

  // Tenant brand — never hardcode a client here; consultancy #2 uses this too.
  const brand = await getOrgBrand(profile.organization_id);
  const theme = resolveTheme(brand.themeKey);

  return (
    <div
      id="tenant-theme-root"
      style={themeStyleVars(theme.tokens)}
      className="flex min-h-screen flex-col bg-tenant-gray"
    >
      {/* Top navbar — full width: tenant logo left, account controls right */}
      <header className="flex h-16 flex-none items-center justify-between border-b border-white/10 bg-tenant-navy p-5 md:p-10 ">
        <Link
          href="/dashboard"
          className="flex items-center rounded-lg  px-3 py-2 shadow-sm"
        >
          {/* Tenant's own logo — falls back to the Aetarix wordmark until they upload one. */}
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt={brand.name}
              className="h-10 w-auto max-w-[160px] object-contain"
            />
          ) : (
            <Image
              src={AETARIX.wordmark}
              alt={AETARIX.name}
              width={295}
              height={96}
              className="h-7 w-auto object-contain"
            />
          )}
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 sm:flex">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-tenant-accent to-tenant-accent2 text-xs font-semibold text-white">
              {initialsFrom(profile.full_name)}
            </span>
            <span className="text-sm font-medium text-tenant-offwhite">
              {profile.full_name}
            </span>
          </div>
          <Badge
            variant={profile.role === 'admin' ? 'accent' : 'neutral'}
            className={
              profile.role === 'admin'
                ? 'border-transparent bg-tenant-accent/15 text-tenant-accent'
                : undefined
            }
          >
            {profile.role}
          </Badge>
          <Link
            href="/change-password"
            title="Change password"
            aria-label="Change password"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-tenant-offwhite/70 transition-colors hover:bg-white/10 hover:text-tenant-offwhite"
          >
            <KeyRound className="h-4 w-4" />
          </Link>
          <SignOutButton
            iconOnly
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-400/20 bg-red-500/10 text-red-300 transition-colors hover:bg-red-500/20 hover:text-red-200"
          />
        </div>
      </header>

      <div className="flex min-w-0 flex-1 flex-col md:flex-row">
        {/* Icon-only sidebar */}
        <aside className="hidden w-16 px-10 flex-none flex-col items-center bg-tenant-navy py-4 md:flex">
          <Sidebar role={profile.role} />
        </aside>

        {/* Mobile nav row — icon-only, horizontal */}
        <div className="flex py-3 items-center border-b border-white/10 bg-tenant-navy md:hidden">
          <Sidebar role={profile.role} orientation="horizontal" />
        </div>

        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
