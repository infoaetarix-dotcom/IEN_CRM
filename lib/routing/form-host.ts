/**
 * Host-based routing for the public form's own subdomain.
 *
 * When `FORM_HOST` is set (e.g. `apply.ienconsultancy.com`) and a request
 * arrives on that host, only the public form pages are served; every other
 * path — the entire CRM — is redirected to `/apply`, so the CRM is unreachable
 * on the form domain. When `FORM_HOST` is unset (local dev and today's single
 * domain), this is a complete no-op and the app behaves exactly as before.
 *
 * Pure + framework-free so the decision is unit-testable; the middleware just
 * applies the result.
 */

/**
 * Public pages the form-only subdomain is allowed to serve. The marketing root
 * (`/`) is deliberately NOT here — it shows a "Staff sign in" link, so on the
 * form domain it redirects to /apply instead (students only ever see the form).
 *
 * `/apply` itself now just redirects to the marketing site (see
 * app/(public)/apply/page.tsx) — the real per-consultancy form lives at
 * `/{slug}/apply`, matched below by pattern rather than listed by name.
 */
export const FORM_ALLOWED_PATHS = ['/apply', '/thank-you'] as const;

/** Matches /{slug}/apply and /{slug}/apply/anything, e.g. /ien/apply. */
const SLUG_APPLY_PATTERN = /^\/[a-z0-9-]{2,40}\/apply(?:\/.*)?$/;

export type FormHostAction = 'not-form-host' | 'allow' | 'redirect-apply';

/** Strip any port and lowercase a Host header value. */
export function normalizeHost(host: string | null | undefined): string {
  return ((host ?? '').split(':')[0] ?? '').trim().toLowerCase();
}

/** Is this path one the form-only subdomain may serve? */
export function isFormPath(pathname: string): boolean {
  if (SLUG_APPLY_PATTERN.test(pathname)) return true;
  return FORM_ALLOWED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );
}

/**
 * Decide how the middleware should treat a request given the configured form
 * host. Returns `'not-form-host'` when the split is off or the request is on
 * the CRM host — the caller then falls through to normal auth handling.
 */
export function formHostAction(
  requestHost: string | null | undefined,
  formHost: string | null | undefined,
  pathname: string,
): FormHostAction {
  const configured = normalizeHost(formHost);
  if (!configured) return 'not-form-host';
  if (normalizeHost(requestHost) !== configured) return 'not-form-host';
  return isFormPath(pathname) ? 'allow' : 'redirect-apply';
}
