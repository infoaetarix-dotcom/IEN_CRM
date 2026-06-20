import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
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

  return (
    <div className="flex min-h-screen bg-cream">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col bg-navy md:flex">
        <div className="px-5 py-6">
          <p className="label-eyebrow text-accent">IEN</p>
          <p className="mt-1 font-serif text-lg text-paper">Visa CRM</p>
        </div>
        <Sidebar role={profile.role} />
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-line bg-white px-6 py-3">
          {/* Mobile nav fallback */}
          <div className="flex items-center gap-3 md:hidden">
            <Link href="/dashboard" className="font-serif text-lg">
              IEN CRM
            </Link>
          </div>
          <div className="hidden md:block" />
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium leading-tight">
                {profile.full_name}
              </p>
              <p className="text-xs text-muted-foreground">{profile.email}</p>
            </div>
            <Badge variant={profile.role === 'admin' ? 'accent' : 'neutral'}>
              {profile.role}
            </Badge>
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
