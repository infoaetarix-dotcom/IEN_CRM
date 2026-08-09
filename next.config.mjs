/** @type {import('next').NextConfig} */

// Content-Security-Policy. Turnstile needs its script + frame; Supabase needs
// connect for auth/REST. Keep this tight and expand only when a real need appears.
//
// Next.js dev mode (Fast Refresh / HMR) requires 'unsafe-eval'. We add it ONLY
// in development so production stays strict (no eval in the built bundle).
const isDev = process.env.NODE_ENV !== 'production';
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  'https://challenges.cloudflare.com',
  ...(isDev ? ["'unsafe-eval'"] : []),
].join(' ');

const baseDirectives = [
  "default-src 'self'",
  `script-src ${scriptSrc}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "frame-src https://challenges.cloudflare.com",
  "connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
];

/**
 * Every route is clickjacking-locked by default (frame-ancestors 'none' +
 * X-Frame-Options DENY). The public apply form is the one deliberate
 * exception — consultancies embed it on their own marketing sites — and
 * it's safe to open up: it's unauthenticated and already reachable by
 * anyone with the URL, so framing it adds no capability an attacker didn't
 * already have.
 */
function buildHeaders({ embeddable }) {
  const csp = [...baseDirectives, embeddable ? null : "frame-ancestors 'none'"]
    .filter(Boolean)
    .join('; ');
  return [
    { key: 'Content-Security-Policy', value: csp },
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains; preload',
    },
    ...(embeddable ? [] : [{ key: 'X-Frame-Options', value: 'DENY' }]),
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
    },
  ];
}

const securityHeaders = buildHeaders({ embeddable: false });
const embeddableHeaders = buildHeaders({ embeddable: true });

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      // Must precede the catch-all — Next.js applies every matching rule,
      // so the catch-all below excludes these two paths by regex instead
      // of relying on rule order to "win".
      { source: '/thank-you', headers: embeddableHeaders },
      { source: '/:slug/apply', headers: embeddableHeaders },
      {
        source: '/((?!thank-you$)(?![^/]+/apply$).*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
