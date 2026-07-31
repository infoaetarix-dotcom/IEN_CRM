import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { formHostAction } from '@/lib/routing/form-host';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Refreshes the Supabase session on every request and guards the admin area.
 * Unauthenticated traffic to /dashboard, /leads, /agents, /templates, and /api
 * (except /api/health and /api/keep-warm) is redirected to /login.
 *
 * If FORM_HOST is configured, requests arriving on that public-form subdomain
 * are handled first: only the form pages are served, everything else (the CRM)
 * is redirected to /apply. Unset FORM_HOST = no-op (single-domain behaviour).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public-form subdomain gate — runs before any auth work and short-circuits.
  const formAction = formHostAction(
    request.headers.get('host'),
    process.env.FORM_HOST,
    pathname,
  );
  if (formAction === 'allow') {
    return NextResponse.next({ request });
  }
  if (formAction === 'redirect-apply') {
    const url = request.nextUrl.clone();
    url.pathname = '/apply';
    url.search = '';
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
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

  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/leads') ||
    pathname.startsWith('/agents') ||
    pathname.startsWith('/templates') ||
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
