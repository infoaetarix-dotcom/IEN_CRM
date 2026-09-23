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
import { ApplicationRowActions, ApplicationStatusChanger } from '@/components/dashboard/applications/application-controls';
import { CreateApplicationDialog } from '@/components/dashboard/applications/create-application-dialog';
import { ApplicationStageTabs } from '@/components/dashboard/applications/application-stage-tabs';
import {
  APPLICATION_STAGES,
  APPLICATION_STATUS_STAGE,
  type ApplicationStage,
  type ApplicationStatus,
} from '@/lib/leads/display';
import { getSignaturesForSender } from '@/lib/email/signatures';

export const metadata = { title: 'Applications' };

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const profile = await requireUser();
  const supabase = await createClient();
  const sp = await searchParams;
  const stageParam = (Array.isArray(sp.stage) ? sp.stage[0] : sp.stage) ?? '';
  const activeStage = (APPLICATION_STAGES as readonly string[]).includes(stageParam)
    ? (stageParam as ApplicationStage)
    : null;

  // Independent reads — the applications list, the lead picker's and
  // university picker's options, the org's email templates (for the
  // row-level Email popup), and the org's portal_domain (for building the
  // student upload link) don't depend on each other, so they're fired
  // together.
  const [{ data: applications }, { data: leads }, { data: templates }, { data: universities }, { data: org }, { data: profiles }, signatures] =
    await Promise.all([
      supabase
        .from('applications')
        .select('id, application_number, status, full_name, email, phone, target_country, program, created_at, created_by, lead_id, document_upload_token, document_upload_expires_at, leads(lead_number, full_name), universities(name, country)')
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
      supabase
        .from('organizations')
        .select('portal_domain')
        .eq('id', profile.organization_id)
        .single(),
      supabase.from('profiles').select('id, full_name'),
      getSignaturesForSender(profile.organization_id!, profile.id),
    ]);

  // Same "portal domain if configured, else the base app domain" fallback
  // the /form page already uses for the application-form link.
  const uploadBaseUrl = org?.portal_domain ? `https://${org.portal_domain}` : APP_URL;
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  // Counts per stage for the tab badges, computed from the same full list —
  // there's no need for a second query at this scale.
  const stageCounts = { application: 0, fee_deposit: 0, visa: 0, enrollment: 0 } as Record<
    ApplicationStage,
    number
  >;
  for (const a of applications ?? []) {
    stageCounts[APPLICATION_STATUS_STAGE[a.status as ApplicationStatus]]++;
  }
  const visibleApplications = activeStage
    ? (applications ?? []).filter((a) => APPLICATION_STATUS_STAGE[a.status as ApplicationStatus] === activeStage)
    : (applications ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title="Applications"
        subtitle="Every application across your leads — each one belongs to exactly one lead."
        action={<CreateApplicationDialog leads={leads ?? []} universities={universities ?? []} />}
      />

      <ApplicationStageTabs counts={stageCounts} total={(applications ?? []).length} />

      <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead #</TableHead>
                <TableHead>Application #</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>University</TableHead>
                <TableHead>Target country / program</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created by</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleApplications.map((a) => {
                const leadRow = Array.isArray(a.leads) ? a.leads[0] : a.leads;
                const university = Array.isArray(a.universities) ? a.universities[0] : a.universities;
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
                      {university ? `${university.name} (${university.country})` : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {[a.target_country, a.program].filter(Boolean).join(' — ') || '—'}
                    </TableCell>
                    <TableCell>
                      <ApplicationStatusChanger
                        applicationId={a.id}
                        current={a.status}
                        className="h-8 w-auto min-w-[11rem] py-1 text-xs"
                      />
                    </TableCell>
                    <TableCell className="text-blue-500 font-semibold">
                      {a.created_by ? (nameById.get(a.created_by) ?? '—') : '—'}
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
                        signatures={signatures}
                        uploadUrl={`${uploadBaseUrl}/upload/${a.document_upload_token}`}
                        uploadExpired={new Date(a.document_upload_expires_at) < new Date()}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {visibleApplications.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    {activeStage
                      ? 'No applications at this stage.'
                      : 'No applications yet — create one from a lead, or the button above.'}
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
