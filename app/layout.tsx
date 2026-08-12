import type { Metadata } from 'next';
import { Inter, Source_Serif_4, Playfair_Display } from 'next/font/google';
import { RegisterServiceWorker } from '@/components/pwa/register-sw';
import './globals.css';

const sans = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const serif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

// Marketing-page display serif (headlines only — see tailwind `font-display`).
const display = Playfair_Display({
  subsets: ['latin'],
  weight: ['600', '700'],
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
