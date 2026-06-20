import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-navy px-6 text-center text-paper">
      <p className="label-eyebrow text-accent">IEN Visa Consultancy</p>
      <h1 className="max-w-2xl font-serif text-4xl leading-tight sm:text-5xl">
        Your journey to studying abroad starts here.
      </h1>
      <p className="max-w-md text-muted">
        Tell us about your goals and our team will reach out within 24 hours.
      </p>
      <div className="flex gap-4">
        <Link
          href="/apply"
          className="rounded-md bg-accent px-6 py-3 font-medium text-white transition hover:opacity-90"
        >
          Start your application
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-paper/30 px-6 py-3 font-medium text-paper transition hover:bg-paper/10"
        >
          Staff sign in
        </Link>
      </div>
    </main>
  );
}
