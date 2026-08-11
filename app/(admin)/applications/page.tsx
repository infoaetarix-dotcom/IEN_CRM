import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { STATUS_LABELS, STATUS_BADGE, type LeadStatus } from '@/lib/leads/display';

export const metadata = { title: 'Applications' };

export default async function ApplicationsPage() {
  await requireUser();
  const supabase = await createClient();

  const { data: applications } = await supabase
    .from('applications')
    .select('id, application_number, status, full_name, target_country, program, created_at, lead_id, leads(lead_number, full_name)')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title="Applications"
        subtitle="Every application across your leads — each one belongs to exactly one lead."
        action={
          <Link
            href="/applications/new"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-tenant-accent px-3 text-sm text-white hover:bg-tenant-accent/90"
          >
            <Plus className="h-4 w-4" /> Create application
          </Link>
        }
      />

      <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead #</TableHead>
                <TableHead>Application #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Target country / program</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(applications ?? []).map((a) => {
                const leadRow = Array.isArray(a.leads) ? a.leads[0] : a.leads;
                return (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap">
                      <Link href={`/leads/${a.lead_id}`} className="hover:text-tenant-accent hover:underline">
                        #{leadRow?.lead_number ?? '—'}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Link href={`/applications/${a.id}`} className="font-medium hover:text-tenant-accent hover:underline">
                        #{a.application_number}
                      </Link>
                    </TableCell>
                    <TableCell>{a.full_name || leadRow?.full_name || '(no name)'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {[a.target_country, a.program].filter(Boolean).join(' — ') || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[a.status as LeadStatus]}>
                        {STATUS_LABELS[a.status as LeadStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(applications ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No applications yet — create one from a lead, or the button above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
