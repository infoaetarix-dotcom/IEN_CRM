import 'server-only';

import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { LAST_ORG_COOKIE } from '@/lib/auth/cookies';
import { brandFromOrg, FALLBACK_BRAND, type OrgBrand } from './index';

const BRAND_COLUMNS = 'name, legal_name, logo_url, theme_key';

/**
 * The signed-in user's organization brand. Memoized per request so a layout
 * and its pages share one query.
 */
export const getOrgBrand = cache(
  async (orgId: string | null): Promise<OrgBrand> => {
    if (!orgId) return FALLBACK_BRAND;
    const supabase = await createClient();
    const { data } = await supabase
      .from('organizations')
      .select(BRAND_COLUMNS)
      .eq('id', orgId)
      .single();
    return data ? brandFromOrg(data) : FALLBACK_BRAND;
  },
);

/**
 * Brand for a public (unauthenticated) surface — the application form, which
 * is reached by org slug. Uses the service role because there is no session to
 * satisfy RLS, and reads only public brand fields.
 */
export const getPublicOrgBrand = cache(
  async (slug: string): Promise<OrgBrand> => {
    const service = createServiceClient();
    const { data } = await service
      .from('organizations')
      .select(BRAND_COLUMNS)
      .eq('slug', slug)
      .maybeSingle();
    return data ? brandFromOrg(data) : FALLBACK_BRAND;
  },
);

/**
 * Best-guess brand for a visitor with no session yet — used by pre-auth
 * surfaces (login, the PWA manifest) that can't read profile.organization_id.
 * On a consultancy's own form_domain/portal_domain, middleware already knows
 * which org that is and forwards it as the x-tenant-slug header; otherwise
 * (the base app domain) this falls back to a "last org" cookie set on a
 * previous successful sign-in. Returns null (never FALLBACK_BRAND) so callers
 * can tell "no guess available" apart from a real org that failed to load.
 */
export async function resolveVisitorBrand(): Promise<OrgBrand | null> {
  const [jar, h] = await Promise.all([cookies(), headers()]);
  const orgSlug = h.get('x-tenant-slug') ?? jar.get(LAST_ORG_COOKIE)?.value;
  return orgSlug ? await getPublicOrgBrand(orgSlug) : null;
}
