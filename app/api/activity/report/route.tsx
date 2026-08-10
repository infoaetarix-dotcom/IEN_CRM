import type { NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { requireActivityAccess } from '@/lib/activity/guard';
import { createClient } from '@/lib/supabase/server';
import { getOrgBrand } from '@/lib/branding/org';
import { resolveTheme } from '@/lib/branding/themes';
import { resolvePdfLogo } from '@/lib/branding/pdf-logo';
import { ActivityReportDocument } from '@/lib/activity/report-pdf';
import type { ActivityEntry } from '@/lib/activity/types';

// @react-pdf/renderer needs real Node (fs, Buffer) — not Edge-compatible.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function iso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function dateRangeFor(key: string): { from: string; to: string; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  switch (key) {
    case 'last_month': {
      const from = new Date(y, m - 1, 1);
      const to = new Date(y, m, 0);
      return {
        from: iso(from),
        to: iso(to),
        label: from.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      };
    }
    case 'this_year':
      return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)), label: `${y}` };
    case 'all_time':
      return { from: '2000-01-01', to: iso(now), label: 'All time' };
    case 'this_month':
    default:
      return {
        from: iso(new Date(y, m, 1)),
        to: iso(new Date(y, m + 1, 0)),
        label: now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
      };
  }
}

export async function GET(request: NextRequest) {
  const profile = await requireActivityAccess();
  const supabase = await createClient();

  const range = request.nextUrl.searchParams.get('range') ?? 'this_month';
  const { from, to, label } = dateRangeFor(range);

  const { data: rawEntries } = await supabase
    .from('activity_entries')
    .select('id, category, title, description, activity_date, created_at')
    .eq('organization_id', profile.organization_id)
    .gte('activity_date', from)
    .lte('activity_date', to)
    .order('activity_date', { ascending: false });

  const entries: ActivityEntry[] = rawEntries ?? [];

  const brand = await getOrgBrand(profile.organization_id);
  const theme = resolveTheme(brand.themeKey);
  const logo = await resolvePdfLogo(brand.logoUrl);

  const docProps = {
    entries,
    orgName: brand.legalName,
    navyHex: theme.tokens.navy,
    accentHex: theme.tokens.accent,
    rangeLabel: label,
  };

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(<ActivityReportDocument {...docProps} logo={logo} />);
  } catch (err) {
    console.error('[activity report] render failed, retrying without a logo', err);
    pdfBuffer = await renderToBuffer(<ActivityReportDocument {...docProps} logo={null} />);
  }

  const safeName = brand.legalName.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const filename = `${safeName || 'Activity'}-Activity-Report-${range}.pdf`;

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
