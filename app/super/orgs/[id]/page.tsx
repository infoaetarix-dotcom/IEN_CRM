import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { SuspendToggle, ModuleToggle } from '@/components/super/org-controls';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

export default async function OrgDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from('organizations')
    .select('id, name, slug, status, created_at')
    .eq('id', id)
    .single();
  if (!org) notFound();

  const [{ data: modules }, { data: orgModules }, { data: staff }, leadsRes] =
    await Promise.all([
      supabase.from('modules').select('key, name, description').order('key'),
      supabase
        .from('organization_modules')
        .select('module_key, enabled')
        .eq('organization_id', id),
      supabase
        .from('profiles')
        .select('id, full_name, role, is_active')
        .eq('organization_id', id),
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', id),
    ]);

  const enabled = new Map(
    (orgModules ?? []).map((m) => [m.module_key, m.enabled]),
  );

  return (
    <div className="space-y-6">
      <Link
        href="/super"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> All consultancies
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-2xl">{org.name}</h1>
            <Badge variant={org.status === 'active' ? 'success' : 'danger'}>
              {org.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Form link:{' '}
            <span className="font-mono">
              {APP_URL}/{org.slug}/apply
            </span>{' '}
            · {leadsRes.count ?? 0} leads
          </p>
        </div>
        <SuspendToggle orgId={org.id} status={org.status} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Package — modules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(modules ?? []).map((m) => (
              <ModuleToggle
                key={m.key}
                orgId={org.id}
                moduleKey={m.key}
                moduleName={m.name}
                enabled={enabled.get(m.key) === true}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(staff ?? []).map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell>
                      <Badge variant={s.role === 'admin' ? 'accent' : 'neutral'}>
                        {s.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.is_active ? 'success' : 'danger'}>
                        {s.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(staff ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-muted-foreground">
                      No staff yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
