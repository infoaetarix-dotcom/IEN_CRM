import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { normalizeHost } from '@/lib/routing/form-host';
import { resolveDomain } from '@/lib/routing/domain-lookup';
import { formDomainDecision, portalDomainDecision, type RouteDecision } from '@/lib/routing/domain-routing';

type CookieToSet = { name: string; value: string; options: CookieOptions };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';

function redirectFor(request: NextRequest, decision: Extract<RouteDecision, { action: 'redirect' }>) {
  if (decision.absolute) {
    return NextResponse.redirect(new URL(decision.to));
  }
  const url = request.nextUrl.clone();
  url.pathname = decision.to;
  url.search = '';
  return NextResponse.redirect(url);
}

/**
 * Refreshes the Supabase session on every request and guards the admin area.
 * Unauthenticated traffic to /dashboard, /leads, /agents, /templates, and /api
 * (except /api/health and /api/keep-warm) is redirected to /login.
 *
 * Before any of that: if the request's Host header matches a consultancy's
 * configured form_domain or portal_domain (Super Admin → Domains), it's
 * handled by the domain-routing rules instead — see lib/routing/domain-*.
 * A request on the base app domain (no match) behaves exactly as before.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = normalizeHost(request.headers.get('host'));
  const domainMatch = await resolveDomain(host);

  // Forward the resolved tenant to pages that want to brand a pre-auth
  // screen (login, forgot-password) by domain instead of guessing from a
  // "last org" cookie — meaningful on a first-ever visit to a custom domain.
  const requestHeaders = new Headers(request.headers);
  if (domainMatch) requestHeaders.set('x-tenant-slug', domainMatch.slug);
  const nextInit = { request: { headers: requestHeaders } };

  if (domainMatch?.kind === 'form') {
    const decision = formDomainDecision(domainMatch.slug, pathname);
    if (decision.action === 'redirect') return redirectFor(request, decision);
    return NextResponse.next(nextInit);
  }

  let response = NextResponse.next(nextInit);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next(nextInit);
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A portal_domain is one consultancy's own branded CRM — never another
  // tenant's, never the platform console. A mismatched or super-admin
  // session gets signed out and sent to the base app domain to sign in with
  // the right account, rather than looping on a domain it doesn't belong on.
  if (domainMatch?.kind === 'portal') {
    let profile: { organization_id: string | null; is_super_admin: boolean } | null = null;
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('organization_id, is_super_admin')
        .eq('id', user.id)
        .single();
      profile = data;
    }

    const decision = portalDomainDecision({
      orgId: domainMatch.orgId,
      pathname,
      user: user
        ? { organizationId: profile?.organization_id ?? null, isSuperAdmin: profile?.is_super_admin ?? false }
        : null,
      appUrl: APP_URL,
    });

    if (decision.action === 'redirect') {
      if (decision.signOut) await supabase.auth.signOut();
      const redirectResponse = redirectFor(request, decision);
      response.cookies.getAll().forEach((c) => redirectResponse.cookies.set(c));
      return redirectResponse;
    }
  }

  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/leads') ||
    pathname.startsWith('/agents') ||
    pathname.startsWith('/templates') ||
    pathname.startsWith('/form') ||
    pathname.startsWith('/change-password') ||
    pathname.startsWith('/super') ||
    (pathname.startsWith('/api') &&
      pathname !== '/api/health' &&
      pathname !== '/api/keep-warm');

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectedFrom', pathname);
    return NextResponse.redirect(url);
  }

  // Bounce signed-in users away from the login page.
  if (pathname === '/login' && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Run on everything except static assets and image optimizer.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
