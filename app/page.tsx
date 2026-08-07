import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  Palette,
  ClipboardList,
  Workflow,
  ShieldCheck,
  Menu,
  ChevronDown,
  Check,
  CheckCircle2,
  LayoutDashboard,
  Users,
  UserCog,
  FileText,
} from 'lucide-react';
import { AETARIX } from '@/lib/branding';
import { ContactForm } from '@/components/marketing/contact-form';

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

const TITLE = 'Study Abroad CRM Software for Consultancies | Aetarix';
const DESCRIPTION =
  'A white-label CRM for study-abroad consultancies to capture leads, manage applicants, track teams, and automate communication under your own brand.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/' },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: AETARIX.name,
    title: TITLE,
    description: DESCRIPTION,
    locale: 'en_US',
    images: [{ url: '/icon-512.png', width: 512, height: 512, alt: AETARIX.name }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: ['/icon-512.png'],
  },
};

const FEATURES = [
  {
    title: 'Fully White-Labeled CRM',
    body: 'Your consultancy gets its own branding, logo, domain, and applicant experience — staff and students see your brand, not ours.',
    icon: Palette,
  },
  {
    title: 'Lead Capture Built In',
    body: 'Capture study-abroad enquiries and applications through a mobile-friendly application form that saves partial submissions, so no lead is lost.',
    icon: ClipboardList,
  },
  {
    title: 'Applicant & Lead Pipeline',
    body: 'Track applicants from initial enquiry through follow-up and conversion with a centralized pipeline — notes, search, filtering, and export included.',
    icon: Workflow,
  },
  {
    title: 'Secure Team Access',
    body: 'Role-based permissions and audit logging help protect sensitive applicant and business data — enforced in the database, not just the UI.',
    icon: ShieldCheck,
  },
] as const;

const SHOWCASE_POINTS = [
  'Capture every lead the moment they enquire, from your branded application form.',
  'Manage applicants with a full profile — documents, notes, and communication history.',
  'Track pipeline stages from enquiry through offer, visa, and enrolment.',
  'Coordinate agents with clear ownership over which leads belong to whom.',
  'Manage communication by email, and WhatsApp on Growth and above.',
  'Monitor team activity with an analytics dashboard on Growth and above.',
] as const;

const BOARD_COLUMNS = [
  { label: 'New', cards: ['A. Rahman', 'S. Karim'] },
  { label: 'In review', cards: ['M. Iqbal'] },
  { label: 'Applied', cards: ['F. Noor', 'H. Patel'] },
] as const;

const HERO_ROWS = [
  { initials: 'AR', name: 'A. Rahman', meta: 'Masters · United Kingdom', status: 'New' },
  { initials: 'SK', name: 'S. Karim', meta: 'Undergrad · Canada', status: 'Contacted' },
  { initials: 'MI', name: 'M. Iqbal', meta: 'Foundation · Australia', status: 'Applied' },
  { initials: 'FN', name: 'F. Noor', meta: 'Masters · United States', status: 'Converted' },
] as const;

const STATUS_STYLES: Record<string, string> = {
  New: 'bg-marketing-blue/10 text-marketing-blue',
  Contacted: 'bg-marketing-cyan/10 text-marketing-cyan',
  Applied: 'bg-marketing-ink/10 text-marketing-ink/70',
  Converted: 'bg-marketing-blue text-white',
};

interface Tier {
  name: string;
  blurb: string;
  items: string[];
  highlighted?: boolean;
}

const TIERS: Tier[] = [
  {
    name: 'Starter',
    blurb: 'Everything a consultancy needs to run leads day to day.',
    items: ['Lead pipeline & CRM', 'Email templates & sending', 'Agent accounts', 'White-label branding'],
  },
  {
    name: 'Growth',
    blurb: 'Starter, plus deeper insight and another channel to reach applicants.',
    items: ['Everything in Starter', 'Analytics dashboard', 'WhatsApp integration'],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    blurb: 'For consultancies that want the full platform, on their own domain.',
    items: ['Everything in Growth', 'AI chatbot', 'Bulk messaging', 'Custom domain', 'Priority support'],
  },
];

const NAV_LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#contact', label: 'Contact' },
] as const;

const FAQS = [
  {
    q: 'What is a study-abroad CRM?',
    a: 'A study-abroad CRM is software built for education consultancies to manage enquiries and applicants — capturing leads, tracking each person’s status through your pipeline, and keeping your team’s notes and communication in one place instead of spreadsheets and inboxes.',
  },
  {
    q: 'Can the CRM be fully white-labeled?',
    a: 'Yes. Your consultancy gets its own name, logo, and branding across the applicant-facing form and staff portal, with a custom domain available on the Enterprise plan — applicants interact with your brand, not Aetarix.',
  },
  {
    q: 'Can multiple agents use the CRM?',
    a: 'Yes. Every plan includes agent accounts with role-based access: admins see the full pipeline for their consultancy, while agents see only the leads assigned to them.',
  },
  {
    q: 'Can the CRM manage applicant leads?',
    a: 'Yes. Leads move through a pipeline with status tracking, notes, search, filtering, and one-click export, so your team always knows where each applicant stands.',
  },
  {
    q: 'Can the CRM integrate with WhatsApp?',
    a: 'Yes, on the Growth plan and above. WhatsApp integration gives your team another channel to reach applicants alongside email, from inside the same pipeline.',
  },
  {
    q: 'Can the CRM run on our own domain?',
    a: 'Yes, on the Enterprise plan. Your applicant form and staff portal can be served from your own custom domain as part of your fully white-labeled setup.',
  },
] as const;

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: AETARIX.name,
  url: AETARIX.url,
  logo: `${SITE_URL}/icon-512.png`,
};

const softwareApplicationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: AETARIX.name,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: DESCRIPTION,
  url: SITE_URL,
  featureList: FEATURES.map((f) => f.title),
};

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
};

export default function Home() {
  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
      />
      {/* eslint-disable-next-line react/no-danger */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-marketing-blue focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to main content
      </a>

      <div className="min-h-screen">
        <header className="sticky top-0 z-40 border-b border-marketing-ink/10 bg-white ">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src={AETARIX.wordmark}
                alt={AETARIX.name}
                width={295}
                height={96}
                className="h-10 w-auto object-contain"
              />
            </Link>
            <nav aria-label="Primary" className="hidden items-center gap-8 sm:flex">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="text-sm font-medium text-marketing-ink/70 transition hover:text-marketing-ink"
                >
                  {l.label}
                </a>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <details className="relative sm:hidden">
                <summary className="disclosure-summary flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-marketing-ink/15 text-marketing-ink">
                  <Menu className="h-5 w-5" aria-hidden="true" />
                  <span className="sr-only">Open menu</span>
                </summary>
                <div className="absolute right-0 top-12 w-52 rounded-lg border border-marketing-ink/10 bg-white p-4 shadow-lg">
                  <nav aria-label="Mobile" className="flex flex-col gap-3">
                    {NAV_LINKS.map((l) => (
                      <a
                        key={l.href}
                        href={l.href}
                        className="text-sm font-medium text-marketing-ink/80 hover:text-marketing-ink"
                      >
                        {l.label}
                      </a>
                    ))}
                  </nav>
                </div>
              </details>
              <Link
                href="/login"
                className="rounded-md bg-marketing-blue px-4 py-2 text-sm font-medium text-white transition hover:bg-marketing-blue/90"
              >
                Sign in
              </Link>
            </div>
          </div>
        </header>

        <main id="main-content">
          {/* Hero */}
          <section
            aria-labelledby="hero-heading"
            className="relative overflow-hidden bg-marketing-navy px-6 py-24 text-marketing-offwhite sm:py-28"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 [background:radial-gradient(60%_50%_at_50%_0%,rgba(37,99,235,0.28),transparent_70%)]"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(248,247,243,0.7)_1px,transparent_1px),linear-gradient(90deg,rgba(248,247,243,0.7)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(60%_55%_at_50%_15%,black,transparent)]"
            />

            <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-6 text-center">
              <p className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.14em] text-marketing-offwhite/70">
                White-label CRM for study-abroad consultancies
              </p>
              <h1
                id="hero-heading"
                className="max-w-3xl font-display text-4xl font-semibold leading-[1.12] sm:text-5xl lg:text-6xl"
              >
                The CRM behind your consultancy&rsquo;s brand
              </h1>
              <p className="max-w-2xl text-lg leading-relaxed text-marketing-offwhite/75">
                A fully white-label CRM built for study-abroad consultancies. Capture
                applicants, manage your lead pipeline, coordinate your team, and
                communicate with every student under your own brand.
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-4">
                <a
                  href="#contact"
                  className="rounded-md bg-marketing-blue px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-marketing-blue/90 sm:text-base"
                >
                  Get in touch
                </a>
                <Link
                  href="/login"
                  className="rounded-md border border-white/25 px-6 py-3 text-sm font-semibold text-marketing-offwhite transition hover:bg-white/10 sm:text-base"
                >
                  Staff sign in
                </Link>
              </div>
              <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-medium uppercase tracking-[0.14em] text-marketing-offwhite/50">
                <li>White-label</li>
                <li aria-hidden="true" className="text-marketing-offwhite/25">
                  &bull;
                </li>
                <li>Secure by design</li>
                <li aria-hidden="true" className="text-marketing-offwhite/25">
                  &bull;
                </li>
                <li>Built for study-abroad consultancies</li>
              </ul>
            </div>

            {/* Product preview — illustrative sample data only */}
            <div
              aria-hidden="true"
              className="relative mx-auto mt-16 max-w-3xl overflow-hidden rounded-xl border border-white/10 bg-white text-marketing-ink shadow-2xl shadow-black/40"
            >
              <div className="flex items-center gap-1.5 border-b border-marketing-ink/10 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-marketing-ink/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-marketing-ink/15" />
                <span className="h-2.5 w-2.5 rounded-full bg-marketing-ink/15" />
                <span className="ml-3 text-xs font-medium text-marketing-ink/40">
                  Leads pipeline — sample data
                </span>
              </div>
              <div className="divide-y divide-marketing-ink/5">
                {HERO_ROWS.map((row) => (
                  <div key={row.name} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-marketing-blue/10 text-xs font-semibold text-marketing-blue">
                        {row.initials}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-marketing-ink">{row.name}</p>
                        <p className="text-xs text-marketing-ink/50">{row.meta}</p>
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Features */}
          <section
            id="features"
            aria-labelledby="features-heading"
            className="border-t border-marketing-ink/5 bg-marketing-offwhite"
          >
            <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
              <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-marketing-blue">
                Features
              </p>
              <h2
                id="features-heading"
                className="mt-3 text-center font-display text-3xl font-semibold text-marketing-ink sm:text-4xl"
              >
                What you get
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-center text-base text-marketing-ink/60">
                A CRM built specifically for study-abroad consultancies — from first
                enquiry to enrolment, under your own brand.
              </p>
              <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {FEATURES.map((f) => (
                  <article
                    key={f.title}
                    className="rounded-xl border border-marketing-ink/10 bg-white p-6 shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-marketing-blue/10 text-marketing-blue">
                      <f.icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <h3 className="mt-4 font-display text-lg font-semibold text-marketing-ink">
                      {f.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-marketing-ink/65">{f.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          {/* Product showcase */}
          <section
            aria-labelledby="showcase-heading"
            className="border-t border-marketing-ink/5 bg-marketing-gray"
          >
            <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
              <div className="grid items-center gap-12 lg:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-marketing-blue">
                    Built for your workflow
                  </p>
                  <h2
                    id="showcase-heading"
                    className="mt-3 font-display text-3xl font-semibold text-marketing-ink sm:text-4xl"
                  >
                    One platform for every applicant journey.
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-marketing-ink/70">
                    From the moment a student submits an enquiry to the day they
                    enrol, Aetarix keeps your consultancy&rsquo;s pipeline, team, and
                    communication in one white-label CRM.
                  </p>
                  <ul className="mt-6 space-y-3">
                    {SHOWCASE_POINTS.map((p) => (
                      <li key={p} className="flex items-start gap-3 text-sm text-marketing-ink/80">
                        <CheckCircle2
                          className="mt-0.5 h-5 w-5 flex-none text-marketing-blue"
                          aria-hidden="true"
                        />
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div
                  aria-hidden="true"
                  className="overflow-hidden rounded-xl border border-marketing-ink/10 bg-white shadow-xl shadow-marketing-ink/5"
                >
                  <div className="flex">
                    <div className="hidden w-14 flex-none flex-col items-center gap-4 border-r border-marketing-ink/10 py-5 sm:flex">
                      {[LayoutDashboard, Users, UserCog, FileText].map((Icon, i) => (
                        <span
                          key={i}
                          className={`flex h-8 w-8 items-center justify-center rounded-md ${
                            i === 0
                              ? 'bg-marketing-blue/10 text-marketing-blue'
                              : 'text-marketing-ink/30'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                      ))}
                    </div>
                    <div className="min-w-0 flex-1 p-5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-marketing-ink/40">
                          Pipeline · sample data
                        </p>
                        <span className="rounded-full bg-marketing-cyan/10 px-2 py-0.5 text-[11px] font-medium text-marketing-cyan">
                          12 active
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-3 gap-3">
                        {BOARD_COLUMNS.map((col) => (
                          <div key={col.label} className="rounded-lg bg-marketing-gray p-2">
                            <p className="px-1 text-[10px] font-semibold uppercase tracking-wide text-marketing-ink/40 sm:text-[11px]">
                              {col.label}
                            </p>
                            <div className="mt-2 space-y-2">
                              {col.cards.map((c) => (
                                <div
                                  key={c}
                                  className="rounded-md border border-marketing-ink/10 bg-white p-2 text-[10px] font-medium text-marketing-ink/70 shadow-sm sm:text-[11px]"
                                >
                                  {c}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Pricing */}
          <section
            id="pricing"
            aria-labelledby="pricing-heading"
            className="border-t border-marketing-ink/5 bg-white"
          >
            <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
              <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-marketing-blue">
                Plans
              </p>
              <h2
                id="pricing-heading"
                className="mt-3 text-center font-display text-3xl font-semibold text-marketing-ink sm:text-4xl"
              >
                Pricing
              </h2>
              <p className="mx-auto mt-3 max-w-lg text-center text-base text-marketing-ink/60">
                Packaged by what your team needs. Every tier is fully white-labeled
                — reach out for pricing tailored to your consultancy&rsquo;s size.
              </p>
              <div className="mt-12 grid gap-6 sm:grid-cols-3">
                {TIERS.map((t) => (
                  <div
                    key={t.name}
                    className={`relative rounded-xl border p-6 ${
                      t.highlighted
                        ? 'border-marketing-blue bg-marketing-blue/[0.04] shadow-lg shadow-marketing-blue/10'
                        : 'border-marketing-ink/10 bg-white shadow-sm'
                    }`}
                  >
                    {t.highlighted && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-marketing-blue px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white">
                        Most Popular
                      </span>
                    )}
                    <h3 className="font-display text-xl font-semibold text-marketing-ink">
                      {t.name}
                    </h3>
                    <p className="mt-1 text-xs text-marketing-ink/60">{t.blurb}</p>
                    <ul className="mt-5 space-y-2.5 text-sm text-marketing-ink/75">
                      {t.items.map((item) => (
                        <li key={item} className="flex items-start gap-2">
                          <Check className="mt-0.5 h-4 w-4 flex-none text-marketing-blue" aria-hidden="true" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                    <a
                      href="#contact"
                      className="mt-6 inline-block rounded-md border border-marketing-ink/15 px-4 py-2 text-sm font-medium text-marketing-ink transition hover:bg-marketing-ink/5"
                    >
                      Contact us
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section
            id="faq"
            aria-labelledby="faq-heading"
            className="border-t border-marketing-ink/5 bg-marketing-offwhite"
          >
            <div className="mx-auto max-w-3xl px-6 py-20 sm:py-24">
              <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-marketing-blue">
                FAQ
              </p>
              <h2
                id="faq-heading"
                className="mt-3 text-center font-display text-3xl font-semibold text-marketing-ink sm:text-4xl"
              >
                Frequently asked questions
              </h2>
              <div className="mt-10 divide-y divide-marketing-ink/10 rounded-xl border border-marketing-ink/10 bg-white">
                {FAQS.map((f) => (
                  <details key={f.q} className="group px-6 py-5">
                    <summary className="disclosure-summary flex cursor-pointer items-center justify-between gap-4">
                      <h3 className="text-base font-medium text-marketing-ink">{f.q}</h3>
                      <ChevronDown
                        className="h-5 w-5 flex-none text-marketing-ink/40 transition-transform duration-200 group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-marketing-ink/70">{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>

          {/* Contact */}
          <section
            id="contact"
            aria-labelledby="contact-heading"
            className="border-t border-white/5 bg-marketing-navy"
          >
            <div className="mx-auto max-w-lg px-6 py-20 sm:py-24">
              <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-marketing-cyan">
                Contact
              </p>
              <h2
                id="contact-heading"
                className="mt-3 text-center font-display text-3xl font-semibold text-marketing-offwhite sm:text-4xl"
              >
                Let&rsquo;s build the right CRM for your consultancy.
              </h2>
              <p className="mx-auto mt-3 max-w-sm text-center text-sm text-marketing-offwhite/60">
                Tell us a bit about what you need and we&rsquo;ll get back to you.
              </p>
              <div className="mt-8">
                <ContactForm />
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t border-white/10 bg-marketing-navy px-6 py-12 text-marketing-offwhite/60">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-8 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
            <div className="max-w-xs">
              <Image
                src={AETARIX.wordmark}
                alt={AETARIX.name}
                width={295}
                height={96}
                className="mx-auto h-6 w-auto object-contain sm:mx-0"
              />
              <p className="mt-3 text-sm leading-relaxed">
                White-label CRM infrastructure for study-abroad consultancies —
                built and hosted under your own brand.
              </p>
            </div>
            <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} className="transition hover:text-marketing-offwhite">
                  {l.label}
                </a>
              ))}
              <Link href="/login" className="transition hover:text-marketing-offwhite">
                Sign in
              </Link>
            </nav>
          </div>
          <p className="mt-10 text-center text-xs text-marketing-offwhite/40">
            &copy; {new Date().getFullYear()} {AETARIX.name}. All rights reserved.
          </p>
        </footer>
      </div>
    </>
  );
}
