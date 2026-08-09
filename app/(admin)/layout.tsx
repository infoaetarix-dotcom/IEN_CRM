import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getOrgBrand } from '@/lib/branding/org';
import { resolveTheme } from '@/lib/branding/themes';
import { themeStyleVars } from '@/lib/branding/theme-style';
import { AETARIX, initialsFrom } from '@/lib/branding';
import { Sidebar } from '@/components/dashboard/sidebar';
import { AccountMenu } from '@/components/dashboard/account-menu';

/**
 * Browser-tab title and favicon for the whole tenant admin panel — the
 * consultancy's own brand, not a fixed "Aetarix CRM". Deliberately read-only
 * and best-effort (never throws/redirects): auth enforcement is the layout
 * component's job below, not metadata generation's.
 */
export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  const brand = await getOrgBrand(profile?.organization_id ?? null);

  return {
    title: { default: brand.name, template: `%s — ${brand.name}` },
    icons: brand.logoUrl ? { icon: brand.logoUrl } : undefined,
  };
}

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

  // Which opt-in modules (e.g. Finance) this org has enabled — drives nav
  // visibility. The route itself re-checks this independently; hiding the
  // link is a UX nicety, not the access control.
  const supabase = await createClient();
  const { data: orgModules } = await supabase
    .from('organization_modules')
    .select('module_key')
    .eq('organization_id', profile.organization_id)
    .eq('enabled', true);
  const enabledModules = (orgModules ?? []).map((m) => m.module_key);

  return (
    <div
      id="tenant-theme-root"
      style={themeStyleVars(theme.tokens)}
      className="bg-tenant-gray flex min-h-screen flex-col"
    >
      {/* Top navbar — full width: tenant logo left, account controls right */}
      <header className="bg-tenant-navy flex h-16 flex-none items-center justify-between border-b border-white/10 p-5 md:p-10">
        <Link
          href="/dashboard"
          className="relative flex items-center rounded-lg px-3 py-2"
        >
          {/* Transparent blurred background */}
          <div className="absolute inset-0 rounded-lg bg-white/5 backdrop-blur-md" />

          {/* Logo stays sharp */}
          <div className="relative z-10">
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
                className="h-10 w-auto object-contain"
              />
            )}
          </div>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <AccountMenu
            fullName={profile.full_name}
            email={profile.email}
            role={profile.role}
            initials={initialsFrom(profile.full_name)}
          />
        </div>
      </header>

      <div className="flex min-w-0 flex-1 flex-col md:flex-row">
        {/* Icon-only sidebar */}
        <aside className="bg-tenant-navy hidden w-16 flex-none flex-col items-center px-10 py-4 md:flex">
          <Sidebar role={profile.role} enabledModules={enabledModules} />
        </aside>

        {/* Mobile nav row — icon-only, horizontal */}
        <div className="bg-tenant-navy flex items-center border-b border-white/10 py-3 md:hidden">
          <Sidebar role={profile.role} enabledModules={enabledModules} orientation="horizontal" />
        </div>

        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
