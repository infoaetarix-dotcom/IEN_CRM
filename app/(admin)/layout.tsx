import Link from 'next/link';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/guards';
import { getOrgBrand } from '@/lib/branding/org';
import { Brandmark } from '@/components/branding/brandmark';
import { PoweredByAetarix } from '@/components/branding/powered-by';
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

  // New staff must set their own password before using the CRM. The
  // /change-password page lives outside this layout, so there's no redirect loop.
  if (profile.must_change_password) redirect('/change-password');

  // Tenant brand — never hardcode a client here; consultancy #2 uses this too.
  const brand = await getOrgBrand(profile.organization_id);

  return (
    <div className="flex min-h-screen bg-cream">
      {/* Sidebar — the consultancy's own brand leads on navy */}
      <aside className="hidden w-60 shrink-0 flex-col bg-navy md:flex">
        <div className="px-5 py-6">
          <Link href="/dashboard" className="block">
            <Brandmark brand={brand} size="h-9" onDark />
          </Link>
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-paper/50">
            Client CRM
          </p>
        </div>
        <Sidebar role={profile.role} />

        {/* Platform attribution sits at the foot of the tenant's own chrome */}
        <div className="mt-auto border-t border-paper/10 px-5 py-4">
          <PoweredByAetarix onDark />
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-line bg-white px-6 py-3">
          {/* Mobile: tenant brand, since the sidebar is hidden */}
          <Link href="/dashboard" className="md:hidden">
            <Brandmark brand={brand} size="h-7" />
          </Link>
          {/* Desktop: Aetarix reads on white, where the blue mark belongs */}
          <div className="hidden md:block">
            <PoweredByAetarix />
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">
                {profile.full_name}
              </p>
              <p className="text-xs text-muted-foreground">{profile.email}</p>
            </div>
            <Badge variant={profile.role === 'admin' ? 'accent' : 'neutral'}>
              {profile.role}
            </Badge>
            <Link
              href="/change-password"
              className="text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              Password
            </Link>
            <SignOutButton />
          </div>
        </header>

        {/* Mobile nav row */}
        <div className="border-b border-line bg-navy md:hidden">
          <Sidebar role={profile.role} />
        </div>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
