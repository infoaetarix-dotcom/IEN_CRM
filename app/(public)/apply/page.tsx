import { Suspense } from 'react';
import { LeadForm } from './lead-form';

export const metadata = {
  title: 'Start your application — IEN Visa Consultancy',
};

export default function ApplyPage() {
  return (
    <main className="min-h-screen bg-cream">
      {/* Editorial header band */}
      <header className="bg-navy px-6 py-12 text-paper">
        <div className="mx-auto max-w-2xl">
          <p className="label-eyebrow text-accent">IEN Visa Consultancy</p>
          <h1 className="mt-3 font-serif text-3xl leading-tight sm:text-4xl">
            Start your study-abroad journey
          </h1>
          <p className="mt-3 max-w-lg text-muted">
            Share a few details and our consultants will reach out within 24
            hours. It takes about two minutes.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10">
        <Suspense fallback={<p className="text-muted">Loading form…</p>}>
          <LeadForm />
        </Suspense>
      </div>

      <footer className="border-t border-line px-6 py-8 text-center text-xs text-muted-foreground">
        Your information is handled confidentially and used only to support your
        application.
      </footer>
    </main>
  );
}
