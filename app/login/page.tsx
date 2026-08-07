import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { LoginForm } from './login-form';
import { AETARIX } from '@/lib/branding';

export const metadata = { title: 'Staff sign in — Aetarix CRM' };

/**
 * Shared sign-in for every consultancy on the platform. The tenant isn't known
 * until after authentication (all clients share one domain), so this page
 * carries the platform brand; the consultancy's own branding takes over once
 * they are signed in. Styled to match the public marketing page (app/page.tsx)
 * since both are Aetarix-branded, pre-tenant surfaces.
 */
export default function LoginPage() {
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
            Staff sign in
          </h1>
          <p className="mt-1 text-sm text-marketing-offwhite/60">
            Sign in to your consultancy&rsquo;s CRM
          </p>
        </div>
        <div className="rounded-xl border border-marketing-ink/10 bg-white p-6 shadow-2xl shadow-black/40">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-marketing-offwhite/40">
          Authorized staff only. All sign-ins are logged.
        </p>
      </div>
    </main>
  );
}
