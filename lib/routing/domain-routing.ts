/**
 * Pure routing decisions for a request that landed on a consultancy's
 * dedicated form_domain or portal_domain (see domain-lookup.ts for how the
 * host is resolved to one). No Supabase, no cookies, no Next types — so
 * these are unit-testable without a server; middleware.ts just applies them.
 */

export type RouteDecision =
  | { action: 'allow' }
  | { action: 'redirect'; to: string; absolute?: boolean; signOut?: boolean };

const ALLOW: RouteDecision = { action: 'allow' };

/**
 * A form_domain serves only that one consultancy's own /{slug}/apply (+
 * /thank-you) — everything else, including the platform console, any other
 * org's slug, and even a bare /apply, redirects to that one page. There's no
 * separate case for /super here: it falls through to the same catch-all as
 * any other unrecognized path.
 */
export function formDomainDecision(orgSlug: string, pathname: string): RouteDecision {
  if (pathname === '/thank-you' || pathname.startsWith(`/${orgSlug}/apply`)) {
    return ALLOW;
  }
  return { action: 'redirect', to: `/${orgSlug}/apply` };
}

/**
 * A portal_domain serves the full CRM, but only to *that* consultancy's own
 * staff — never the platform console, never another tenant's session. A
 * mismatched or super-admin session is signed out and bounced to the base
 * app domain to sign in with the right account, rather than looping on a
 * domain it doesn't belong on.
 */
export function portalDomainDecision(params: {
  orgId: string;
  pathname: string;
  user: { organizationId: string | null; isSuperAdmin: boolean } | null;
  appUrl: string;
}): RouteDecision {
  const { orgId, pathname, user, appUrl } = params;

  if (pathname.startsWith('/super')) {
    return { action: 'redirect', to: '/login' };
  }
  if (pathname === '/') {
    return { action: 'redirect', to: '/login' };
  }
  if (user && (user.isSuperAdmin || user.organizationId !== orgId)) {
    return appUrl
      ? { action: 'redirect', to: `${appUrl}/login`, absolute: true, signOut: true }
      : { action: 'redirect', to: '/login', signOut: true };
  }
  return ALLOW;
}
