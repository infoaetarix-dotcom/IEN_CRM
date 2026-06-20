import { Suspense } from 'react';
import { LoginForm } from './login-form';

export const metadata = { title: 'Staff sign in — IEN Visa Consultancy' };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="label-eyebrow text-accent">IEN Visa Consultancy</p>
          <h1 className="mt-2 font-serif text-2xl text-paper">Staff sign in</h1>
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
