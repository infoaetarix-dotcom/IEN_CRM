import 'server-only';

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { brandFromOrg, FALLBACK_BRAND, type OrgBrand } from './index';

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
      .select('name, legal_name, logo_url')
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
      .select('name, legal_name, logo_url')
      .eq('slug', slug)
      .maybeSingle();
    return data ? brandFromOrg(data) : FALLBACK_BRAND;
  },
);
