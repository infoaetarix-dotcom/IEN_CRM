import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FilePlus2 } from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { ApplicationForm, type ApplicationFormValues } from '@/components/dashboard/applications/application-form';
import { SelectLeadForApplication } from '@/components/dashboard/applications/select-lead-for-application';

export const metadata = { title: 'New Application' };

const s = (v: unknown) => (v == null ? '' : String(v));

export default async function NewApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ lead_id?: string }>;
}) {
  await requireUser();
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

  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single();
  if (!lead) notFound();

  const initial: ApplicationFormValues = {
    full_name: s(lead.full_name),
    email: s(lead.email),
    phone: s(lead.phone),
    date_of_birth: lead.date_of_birth ? s(lead.date_of_birth).slice(0, 10) : '',
    city: s(lead.city),
    district: s(lead.district),
    target_country: s(lead.target_country),
    institution: s(lead.institution),
    program: s(lead.program),
    intake_season: s(lead.intake_season),
    intake_year: s(lead.intake_year),
    highest_education: s(lead.highest_education),
    last_qualification: s(lead.last_qualification),
    prior_institution: s(lead.prior_institution),
    passing_year: s(lead.passing_year),
    grading_system: s(lead.grading_system),
    grade_value: s(lead.grade_value),
    work_experience_years: s(lead.work_experience_years),
    work_experience_detail: s(lead.work_experience_detail),
    english_test: s(lead.english_test),
    english_score: s(lead.english_score),
    funding_source: s(lead.funding_source),
    prior_rejection: lead.prior_rejection === true,
    prior_rejection_detail: s(lead.prior_rejection_detail),
    passport_number: '',
    status: 'new',
  };

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
      <ApplicationForm leadId={leadId} initial={initial} />
    </div>
  );
}
