import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { RegisterServiceWorker } from '@/components/pwa/register-sw';
import './globals.css';

// Self-hosted (not next/font/google) so the build never depends on reaching
// Google's font servers at build time — that's exactly what caused a CI
// build failure when GitHub's runner couldn't reach fonts.gstatic.com. Same
// files, pulled once from the same Google Fonts CDN and checked into
// app/fonts/, so the rendered result is identical.
const sans = localFont({
  src: './fonts/Inter-Variable.woff2',
  weight: '100 900',
  variable: '--font-sans',
  display: 'swap',
});

const serif = localFont({
  src: './fonts/SourceSerif4-Variable.woff2',
  weight: '200 900',
  variable: '--font-serif',
  display: 'swap',
});

// Marketing-page display serif (headlines only — see tailwind `font-display`).
const display = localFont({
  src: './fonts/PlayfairDisplay-600-700.woff2',
  weight: '600 700',
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: 'Aetarix CRM',
  description: 'Study-abroad and student-visa consultancy.',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Aetarix CRM' },
};

// Aetarix default navy — the installed app's per-tenant color (see
// app/manifest.ts) overrides this once installed; this is just the browser
// chrome tint while visiting normally, before any org context is known.
export const viewport = { themeColor: '#0B1220' };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${display.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
