/**
 * Small host/path helpers shared by the domain-routing system (see
 * domain-lookup.ts and domain-routing.ts) — which host a request arrived on,
 * and whether a given path is one the public form is allowed to serve.
 *
 * Per-org custom domains (form_domain / portal_domain, configured in Super
 * Admin) replaced the old single-domain FORM_HOST split; these two are the
 * bits of that original design still in use.
 */

/**
 * Public pages a form-only domain is allowed to serve. The marketing root
 * (`/`) is deliberately NOT here — it shows a "Staff sign in" link, so on a
 * form domain it redirects to that org's /{slug}/apply instead (students
 * only ever see the form).
 *
 * `/apply` itself just redirects to the marketing site (see
 * app/(public)/apply/page.tsx) — the real per-consultancy form lives at
 * `/{slug}/apply`, matched below by pattern rather than listed by name.
 */
export const FORM_ALLOWED_PATHS = ['/apply', '/thank-you'] as const;

/** Matches /{slug}/apply and /{slug}/apply/anything, e.g. /ien/apply. */
const SLUG_APPLY_PATTERN = /^\/[a-z0-9-]{2,40}\/apply(?:\/.*)?$/;

/** Strip any port and lowercase a Host header value. */
export function normalizeHost(host: string | null | undefined): string {
  return ((host ?? '').split(':')[0] ?? '').trim().toLowerCase();
}

/** Is this path one a form-only domain may serve? */
export function isFormPath(pathname: string): boolean {
  if (SLUG_APPLY_PATTERN.test(pathname)) return true;
  return FORM_ALLOWED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}
