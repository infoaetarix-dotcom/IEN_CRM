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
    <div className="min-h-screen bg-cream">
      <header className="border-b border-line bg-navy text-paper">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/super" className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent" />
            <span className="font-serif text-lg">Aetarix · Platform Console</span>
          </Link>
          <div className="flex items-center gap-4">
            <Badge variant="accent">super admin</Badge>
            <span className="text-sm text-muted">{profile.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
