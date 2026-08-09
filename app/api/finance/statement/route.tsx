import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { requireFinanceAccess } from '@/lib/finance/guard';
import { createClient } from '@/lib/supabase/server';
import { getOrgBrand } from '@/lib/branding/org';
import { resolveTheme } from '@/lib/branding/themes';
import { StatementDocument, type StatementLogo } from '@/lib/finance/statement-pdf';
import { extractLeadName, type FinanceEntry } from '@/lib/finance/types';

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

// Only formats react-pdf can decode without extra native tooling. A tenant
// logo in another format (SVG, WEBP) falls back to the Aetarix mark below
// rather than risk the whole statement failing to render.
const SAFE_IMAGE_EXT = /\.(png|jpe?g)(\?.*)?$/i;

/**
 * Always resolve to raw image bytes ourselves rather than handing react-pdf
 * a URL or filesystem path to resolve internally — its <Image src> always
 * goes through fetch() to resolve a string source, which throws on a plain
 * local path (confirmed: fails with "fetch failed") and adds an unnecessary
 * failure point for a remote tenant logo too. Fetching/reading here gives
 * one consistent, catchable failure mode for both cases.
 */
async function resolveLogo(logoUrl: string | null): Promise<StatementLogo | null> {
  if (logoUrl && SAFE_IMAGE_EXT.test(logoUrl)) {
    try {
      const res = await fetch(logoUrl);
      if (!res.ok) throw new Error(`logo fetch failed: ${res.status}`);
      const data = Buffer.from(await res.arrayBuffer());
      const format = /\.png(\?.*)?$/i.test(logoUrl) ? 'png' : 'jpg';
      return { data, format };
    } catch (err) {
      console.error('[finance statement] tenant logo fetch failed, using Aetarix mark instead', err);
    }
  }
  try {
    const data = await readFile(path.join(process.cwd(), 'public', 'icon-512.png'));
    return { data, format: 'png' };
  } catch (err) {
    console.error('[finance statement] Aetarix fallback mark failed to load', err);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const profile = await requireFinanceAccess();
  const supabase = await createClient();

  const range = request.nextUrl.searchParams.get('range') ?? 'this_month';
  const { from, to, label } = dateRangeFor(range);

  const { data: rawEntries } = await supabase
    .from('finance_entries')
    .select(
      'id, type, amount, category, payment_method, note, entry_date, lead_id, created_at, leads(full_name)',
    )
    .eq('user_id', profile.id)
    .gte('entry_date', from)
    .lte('entry_date', to)
    .order('entry_date', { ascending: false });

  const entries: FinanceEntry[] = (rawEntries ?? []).map((e) => ({
    id: e.id,
    type: e.type,
    amount: Number(e.amount),
    category: e.category,
    payment_method: e.payment_method,
    note: e.note,
    lead_id: e.lead_id,
    lead_name: extractLeadName(e.leads),
    entry_date: e.entry_date,
    created_at: e.created_at,
  }));

  const brand = await getOrgBrand(profile.organization_id);
  const theme = resolveTheme(brand.themeKey);
  const logo = await resolveLogo(brand.logoUrl);

  const docProps = {
    entries,
    fullName: profile.full_name,
    role: profile.role,
    orgName: brand.legalName,
    navyHex: theme.tokens.navy,
    accentHex: theme.tokens.accent,
    rangeLabel: label,
  };

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderToBuffer(<StatementDocument {...docProps} logo={logo} />);
  } catch (err) {
    // Something else in rendering failed (not the logo — that already has
    // its own fallback above) — retry once with no image at all rather
    // than fail the whole statement.
    console.error('[finance statement] render failed, retrying without a logo', err);
    pdfBuffer = await renderToBuffer(<StatementDocument {...docProps} logo={null} />);
  }

  const safeName = profile.full_name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const filename = `${safeName || 'Statement'}-Finance-Statement-${range}.pdf`;

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
