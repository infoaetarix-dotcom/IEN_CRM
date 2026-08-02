import { Suspense } from 'react';
import { LoginForm } from './login-form';
import { AETARIX } from '@/lib/branding';

export const metadata = { title: 'Staff sign in — Aetarix CRM' };

/**
 * Shared sign-in for every consultancy on the platform. The tenant isn't known
 * until after authentication (all clients share one domain), so this page
 * carries the platform brand; the consultancy's own branding takes over once
 * they are signed in.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mb-5 flex justify-center">
            {/* The wordmark is dark blue; a light plate keeps it legible on navy. */}
            <span className="inline-flex items-center rounded-lg bg-paper px-5 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={AETARIX.wordmark}
                alt={AETARIX.name}
                className="h-8 w-auto object-contain"
              />
            </span>
          </div>
          <h1 className="font-serif text-2xl text-paper">Staff sign in</h1>
          <p className="mt-1 text-sm text-paper/60">
            Sign in to your consultancy&rsquo;s CRM
          </p>
        </div>
        <div className="rounded-lg bg-white p-6 shadow-lg">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-muted">
          Authorized staff only. All sign-ins are logged.
        </p>
      </div>
    </main>
  );
}
