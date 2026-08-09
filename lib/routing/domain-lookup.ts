import 'server-only';

import { normalizeHost } from './form-host';

export interface DomainMatch {
  orgId: string;
  slug: string;
  kind: 'form' | 'portal';
}

interface CacheEntry {
  match: DomainMatch | null;
  expiresAt: number;
}

// Best-effort only: middleware runs on the Edge, where module state survives
// between requests on a warm instance but isn't guaranteed to. A stale hit is
// at most CACHE_TTL_MS old, which is fine for routing — the actual security
// checks (RLS, session auth) never depend on this cache.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

interface OrgRow {
  id: string;
  slug: string;
}

/**
 * Raw REST call rather than the @supabase/supabase-js client: that package
 * pulls in Node-only internals (e.g. reads `process.version`) that fail at
 * runtime — not just a build warning — once bundled into Next's Edge
 * Middleware runtime. Plain `fetch` against PostgREST is a standard Web API
 * and works there natively. The host is passed through `encodeURIComponent`
 * into a single `column=eq.<value>` filter, never string-concatenated into a
 * larger filter expression, so a crafted Host header can't escape its own
 * query-param value.
 */
async function lookupByColumn(
  supabaseUrl: string,
  serviceKey: string,
  column: 'form_domain' | 'portal_domain',
  host: string,
): Promise<OrgRow | null> {
  const url = `${supabaseUrl}/rest/v1/organizations?select=id,slug&${column}=eq.${encodeURIComponent(host)}&limit=1`;
  const res = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as OrgRow[];
  return rows[0] ?? null;
}

/**
 * Resolve an incoming Host header to a consultancy's configured form_domain
 * or portal_domain, if any. Runs with the service role (there's no session
 * yet — this decides routing before auth even happens).
 */
export async function resolveDomain(
  rawHost: string | null | undefined,
): Promise<DomainMatch | null> {
  const host = normalizeHost(rawHost);
  if (!host) return null;

  const cached = cache.get(host);
  if (cached && cached.expiresAt > Date.now()) return cached.match;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;

  const [formOrg, portalOrg] = await Promise.all([
    lookupByColumn(supabaseUrl, serviceKey, 'form_domain', host),
    lookupByColumn(supabaseUrl, serviceKey, 'portal_domain', host),
  ]);

  const match: DomainMatch | null = formOrg
    ? { orgId: formOrg.id, slug: formOrg.slug, kind: 'form' }
    : portalOrg
      ? { orgId: portalOrg.id, slug: portalOrg.slug, kind: 'portal' }
      : null;

  cache.set(host, { match, expiresAt: Date.now() + CACHE_TTL_MS });
  return match;
}
