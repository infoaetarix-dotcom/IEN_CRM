import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FilePlus2 } from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { ApplicationForm } from '@/components/dashboard/applications/application-form';
import { SelectLeadForApplication } from '@/components/dashboard/applications/select-lead-for-application';
import { leadToApplicationDefaults } from '@/lib/applications/types';

export const metadata = { title: 'New Application' };

export default async function NewApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ lead_id?: string }>;
}) {
  const profile = await requireUser();
  const { lead_id: leadId } = await searchParams;
  const supabase = await createClient();

  if (!leadId) {
    const { data: leads } = await supabase
      .from('leads')
      .select('id, full_name')
      .order('full_name');
    return (
      <div className="space-y-6">
        <Link
          href="/applications"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-tenant-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Back to applications
        </Link>
        <PageHeader icon={FilePlus2} title="New application" subtitle="Step 1 of 2 — choose the lead" />
        <SelectLeadForApplication leads={leads ?? []} />
      </div>
    );
  }

  const [{ data: lead }, { data: universities }] = await Promise.all([
    supabase.from('leads').select('*').eq('id', leadId).single(),
    supabase
      .from('universities')
      .select('id, name, country, created_at')
      .eq('organization_id', profile.organization_id)
      .order('name'),
  ]);
  if (!lead) notFound();

  const initial = leadToApplicationDefaults(lead);

  return (
    <div className="space-y-6">
      <Link
        href={`/leads/${leadId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-tenant-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {lead.full_name || 'lead'}
      </Link>
      <PageHeader
        icon={FilePlus2}
        title="New application"
        subtitle={`Pre-filled from ${lead.full_name || 'this lead'} — review and add a passport number before saving.`}
      />
      <ApplicationForm leadId={leadId} initial={initial} universities={universities ?? []} />
    </div>
  );
}
