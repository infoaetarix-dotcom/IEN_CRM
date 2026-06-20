import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

export const metadata = {
  title: 'Application received — IEN Visa Consultancy',
};

export default function ThankYouPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-navy px-6 text-center text-paper">
      <CheckCircle2 className="h-14 w-14 text-accent" />
      <p className="label-eyebrow mt-6 text-accent">Application received</p>
      <h1 className="mt-3 max-w-xl font-serif text-3xl leading-tight sm:text-4xl">
        Thank you — we&apos;ve got your details.
      </h1>
      <p className="mt-4 max-w-md text-muted">
        A confirmation email is on its way. One of our consultants will reach
        out within 24 hours to discuss your study-abroad plans.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-md border border-paper/30 px-6 py-3 text-sm font-medium text-paper transition hover:bg-paper/10"
      >
        Back to home
      </Link>
    </main>
  );
}
