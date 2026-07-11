import Link from 'next/link';
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
import { Card, CardContent } from '@/components/ui/card';
import { CreateOrgForm } from '@/components/super/create-org-form';
import { DEFAULT_MODULES } from '@/lib/org/defaults';

export const metadata = { title: 'Consultancies — Aetarix Console' };

export default async function SuperHome() {
  const supabase = await createClient();

  const [{ data: orgs }, { data: leadRows }, { data: modules }] =
    await Promise.all([
      supabase
        .from('organizations')
        .select('id, name, slug, status, created_at')
        .order('created_at', { ascending: true }),
      supabase.from('leads').select('organization_id'),
      supabase.from('modules').select('key, name'),
    ]);

  const leadCount = new Map<string, number>();
  for (const r of leadRows ?? []) {
    leadCount.set(r.organization_id, (leadCount.get(r.organization_id) ?? 0) + 1);
  }

  const totalLeads = leadRows?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="label-eyebrow">Platform</p>
          <h1 className="font-serif text-2xl">Consultancies</h1>
        </div>
        <CreateOrgForm
          modules={modules ?? []}
          defaultModules={[...DEFAULT_MODULES]}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="label-eyebrow">Consultancies</p>
            <p className="mt-2 font-serif text-3xl">{orgs?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="label-eyebrow">Active</p>
            <p className="mt-2 font-serif text-3xl">
              {(orgs ?? []).filter((o) => o.status === 'active').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="label-eyebrow">Total leads (all)</p>
            <p className="mt-2 font-serif text-3xl">{totalLeads}</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-lg border border-line bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Consultancy</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Leads</TableHead>
              <TableHead className="text-right">Manage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(orgs ?? []).map((o) => (
              <TableRow key={o.id}>
                <TableCell className="font-medium">{o.name}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {o.slug}
                </TableCell>
                <TableCell>
                  <Badge variant={o.status === 'active' ? 'success' : 'danger'}>
                    {o.status}
                  </Badge>
                </TableCell>
                <TableCell>{leadCount.get(o.id) ?? 0}</TableCell>
                <TableCell className="text-right">
                  <Link
                    href={`/super/orgs/${o.id}`}
                    className="text-sm text-accent hover:underline"
                  >
                    Manage →
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
