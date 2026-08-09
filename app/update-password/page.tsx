import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { ChangePasswordForm } from '../change-password/change-password-form';
import { Card, CardContent } from '@/components/ui/card';
import { AETARIX } from '@/lib/branding';
import { getOrgBrand } from '@/lib/branding/org';
import { resolveTheme } from '@/lib/branding/themes';
import { themeStyleVars } from '@/lib/branding/theme-style';

/** Read-only and best-effort — auth enforcement is the page component's job. */
export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { title: 'Set a new password — CRM' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();
  const brand = await getOrgBrand(profile?.organization_id ?? null);
  return {
    title: `Set a new password — ${brand.name}`,
    icons: brand.logoUrl ? { icon: brand.logoUrl } : undefined,
  };
}

// Reached from a reset email via /auth/callback, which establishes a recovery
// session. requireUser ensures that session exists (else → /login).
export default async function UpdatePasswordPage() {
  const profile = await requireUser();
  const brand = await getOrgBrand(profile.organization_id);
  const theme = resolveTheme(brand.themeKey);

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
            {brand.logoUrl ? (
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
            Set a new password
          </h1>
          <p className="mt-1 text-sm text-tenant-offwhite/60">
            Choose a new password for your account.
          </p>
        </div>
        <Card className="rounded-xl border-tenant-ink/10 shadow-2xl shadow-black/40">
          <CardContent className="space-y-4 p-6">
            <ChangePasswordForm forced={false} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
