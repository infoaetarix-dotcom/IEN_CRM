import Image from 'next/image';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/guards';
import { ChangePasswordForm } from './change-password-form';
import { Card, CardContent } from '@/components/ui/card';
import { AETARIX } from '@/lib/branding';

export const metadata = { title: 'Change password — CRM' };

export default async function ChangePasswordPage() {
  const profile = await requireUser();
  const forced = profile.must_change_password;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-marketing-navy px-6 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_50%_0%,rgba(37,99,235,0.28),transparent_70%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(248,247,243,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(248,247,243,0.7)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(60%_55%_at_50%_15%,black,transparent)]"
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <Link href="/" className="mb-6 inline-flex items-center justify-center">
            <Image
              src={AETARIX.wordmark}
              alt={AETARIX.name}
              width={295}
              height={96}
              className="h-8 w-auto object-contain"
            />
          </Link>
          <h1 className="font-display text-2xl font-semibold text-marketing-offwhite">
            {forced ? 'Set your password' : 'Change password'}
          </h1>
          <p className="mt-1 text-sm text-marketing-offwhite/60">
            {forced
              ? `Welcome, ${profile.full_name.split(' ')[0]}. For security, please set your own password before continuing.`
              : 'Choose a new password for your account.'}
          </p>
        </div>
        <Card className="rounded-xl border-marketing-ink/10 shadow-2xl shadow-black/40">
          <CardContent className="space-y-4 p-6">
            <ChangePasswordForm forced={forced} />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
