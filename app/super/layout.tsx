import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { requireSuperAdmin } from '@/lib/auth/guards';
import { SignOutButton } from '@/components/dashboard/sign-out-button';
import { Badge } from '@/components/ui/badge';

export default async function SuperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await requireSuperAdmin();

  return (
    <div className="min-h-screen bg-marketing-gray">
      <header className="border-b border-white/10 bg-marketing-navy text-marketing-offwhite">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/super" className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-marketing-blue" />
            <span className="font-display text-lg font-semibold">
              Aetarix · Platform Console
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Badge variant="accent" className="border-transparent bg-marketing-blue/15 text-marketing-blue">
              super admin
            </Badge>
            <span className="text-sm text-marketing-offwhite/60">{profile.email}</span>
            <span className="[&_button]:text-marketing-offwhite/60 [&_button:hover]:text-white">
              <SignOutButton />
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
