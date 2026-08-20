import Link from 'next/link';
import { FileText } from 'lucide-react';
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
import { CreateApplicationDialog } from '@/components/dashboard/applications/create-application-dialog';
import { ApplicationRowActions } from '@/components/dashboard/applications/application-controls';
import { STATUS_LABELS, STATUS_BADGE, type LeadStatus } from '@/lib/leads/display';

export const metadata = { title: 'Applications' };

export default async function ApplicationsPage() {
  const profile = await requireUser();
  const supabase = await createClient();

  // Independent reads — the applications list, the lead picker's and
  // university picker's options, and the org's email templates (for the
  // row-level Email popup) don't depend on each other, so they're fired
  // together.
  const [{ data: applications }, { data: leads }, { data: templates }, { data: universities }] =
    await Promise.all([
      supabase
        .from('applications')
        .select('id, application_number, status, full_name, email, phone, target_country, program, created_at, lead_id, leads(lead_number, full_name)')
        .order('created_at', { ascending: false }),
      supabase.from('leads').select('id, full_name').order('full_name'),
      supabase
        .from('email_templates')
        .select('key, name, subject, body')
        .eq('organization_id', profile.organization_id)
        .order('is_auto', { ascending: false }),
      supabase
        .from('universities')
        .select('id, name, country, created_at')
        .eq('organization_id', profile.organization_id)
        .order('name'),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title="Applications"
        subtitle="Every application across your leads — each one belongs to exactly one lead."
        action={<CreateApplicationDialog leads={leads ?? []} universities={universities ?? []} />}
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
                <TableHead className="text-right">Actions</TableHead>
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
                    <TableCell className="text-right">
                      <ApplicationRowActions
                        applicationId={a.id}
                        fullName={a.full_name || leadRow?.full_name || '(no name)'}
                        email={a.email}
                        phone={a.phone}
                        templates={templates ?? []}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {(applications ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
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
