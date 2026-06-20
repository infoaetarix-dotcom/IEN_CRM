import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { LeadsFilters } from '@/components/dashboard/leads-filters';
import {
  STATUS_LABELS,
  STATUS_BADGE,
  SOURCE_LABELS,
  isLeadStatus,
  type LeadStatus,
  type LeadSource,
} from '@/lib/leads/display';

export const metadata = { title: 'Leads — IEN CRM' };

const PAGE_SIZE = 20;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function str(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

// Strip characters that would break a PostgREST or() filter.
function sanitize(q: string): string {
  return q.replace(/[,()*]/g, ' ').trim().slice(0, 80);
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireUser();
  const sp = await searchParams;

  const q = sanitize(str(sp.q));
  const status = str(sp.status);
  const source = str(sp.source);
  const agent = str(sp.agent);
  const from = str(sp.from);
  const to = str(sp.to);
  const page = Math.max(1, parseInt(str(sp.page) || '1', 10) || 1);
  const sort = str(sp.sort) || 'created_at';
  const dir = str(sp.dir) === 'asc' ? 'asc' : 'desc';
  const sortCol = ['created_at', 'full_name', 'status'].includes(sort)
    ? sort
    : 'created_at';

  const supabase = await createClient();

  let query = supabase
    .from('leads')
    .select(
      'id, full_name, email, phone, utm_source, status, assigned_to, created_at',
      { count: 'exact' },
    );

  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  if (status && isLeadStatus(status)) query = query.eq('status', status);
  if (source) query = query.eq('utm_source', source);
  if (agent === 'unassigned') query = query.is('assigned_to', null);
  else if (agent) query = query.eq('assigned_to', agent);
  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', `${to}T23:59:59`);

  const offset = (page - 1) * PAGE_SIZE;
  const { data: leads, count } = await query
    .order(sortCol, { ascending: dir === 'asc' })
    .range(offset, offset + PAGE_SIZE - 1);

  // Agent name map + filter options (admin sees all profiles; agent sees self).
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active');
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const agentOptions = (profiles ?? [])
    .filter((p) => p.is_active)
    .map((p) => ({ id: p.id, full_name: p.full_name }));

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const buildPageHref = (p: number) => {
    const next = new URLSearchParams();
    if (q) next.set('q', q);
    if (status) next.set('status', status);
    if (source) next.set('source', source);
    if (agent) next.set('agent', agent);
    if (from) next.set('from', from);
    if (to) next.set('to', to);
    if (sort !== 'created_at') next.set('sort', sort);
    if (dir !== 'desc') next.set('dir', dir);
    next.set('page', String(p));
    return `/leads?${next.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="label-eyebrow">Leads</p>
          <h1 className="font-serif text-2xl">All leads</h1>
        </div>
        <p className="text-sm text-muted-foreground">{total} total</p>
      </div>

      <LeadsFilters
        agents={agentOptions}
        showAgentFilter={profile.role === 'admin'}
      />

      <div className="rounded-lg border border-line bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Contact</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Status</TableHead>
              {profile.role === 'admin' && (
                <TableHead className="hidden lg:table-cell">Assigned</TableHead>
              )}
              <TableHead className="hidden sm:table-cell">Received</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(leads ?? []).length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  No leads match your filters.
                </TableCell>
              </TableRow>
            )}
            {(leads ?? []).map((l) => (
              <TableRow key={l.id} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link href={`/leads/${l.id}`} className="block hover:underline">
                    {l.full_name}
                  </Link>
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">
                  <div>{l.email}</div>
                  <div className="text-xs">{l.phone}</div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {SOURCE_LABELS[l.utm_source as LeadSource] ?? l.utm_source}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGE[l.status as LeadStatus]}>
                    {STATUS_LABELS[l.status as LeadStatus] ?? l.status}
                  </Badge>
                </TableCell>
                {profile.role === 'admin' && (
                  <TableCell className="hidden text-muted-foreground lg:table-cell">
                    {l.assigned_to
                      ? (nameById.get(l.assigned_to) ?? '—')
                      : '—'}
                  </TableCell>
                )}
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {new Date(l.created_at).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Link
            href={buildPageHref(Math.max(1, page - 1))}
            aria-disabled={page <= 1}
            className={`inline-flex h-9 items-center gap-1 rounded-md border border-line px-3 text-sm ${
              page <= 1
                ? 'pointer-events-none opacity-40'
                : 'hover:bg-secondary'
            }`}
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </Link>
          <Link
            href={buildPageHref(Math.min(totalPages, page + 1))}
            aria-disabled={page >= totalPages}
            className={`inline-flex h-9 items-center gap-1 rounded-md border border-line px-3 text-sm ${
              page >= totalPages
                ? 'pointer-events-none opacity-40'
                : 'hover:bg-secondary'
            }`}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
