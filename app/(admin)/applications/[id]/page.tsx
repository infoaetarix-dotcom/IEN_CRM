import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, GraduationCap } from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { ageFromDob } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { STATUS_LABELS, STATUS_BADGE, type LeadStatus } from '@/lib/leads/display';
import { CODE_LABELS } from '@/lib/form-options';
import { ApplicationDetailToggle } from '@/components/dashboard/applications/application-detail-toggle';
import type { ApplicationFormValues } from '@/components/dashboard/applications/application-form';
import {
  ApplicationStatusChanger,
  ApplicationNoteComposer,
  DeleteApplicationButton,
} from '@/components/dashboard/applications/application-controls';
import { DocumentsPanel } from '@/components/dashboard/applications/documents-panel';
import { UploadLinkCard } from '@/components/dashboard/applications/upload-link-card';
import type { ApplicationDocument } from '@/lib/applications/types';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

function fmtDateTime(s: string) {
  return new Date(s).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-tenant-accent">
        {label}
      </p>
      <p className="mt-0.5 text-sm">{value || '—'}</p>
    </div>
  );
}

const s = (v: unknown) => (v == null ? '' : String(v));

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await requireUser();
  const supabase = await createClient();

  const { data: app } = await supabase
    .from('applications')
    .select('*, universities(id, name, country)')
    .eq('id', id)
    .single();
  if (!app) notFound();

  const [{ data: lead }, { data: rawDocuments }, { data: notes }, { data: profiles }, { data: universities }, { data: org }] =
    await Promise.all([
      supabase.from('leads').select('id, full_name, lead_number').eq('id', app.lead_id).single(),
      supabase
        .from('application_documents')
        .select('id, file_name, file_size, uploaded_by, uploaded_by_student, created_at')
        .eq('application_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('application_notes')
        .select('id, body, author_id, created_at')
        .eq('application_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, email'),
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
    ]);

  const uploadBaseUrl = org?.portal_domain ? `https://${org.portal_domain}` : APP_URL;
  const uploadUrl = `${uploadBaseUrl}/upload/${app.document_upload_token}`;

  const university = Array.isArray(app.universities) ? app.universities[0] : app.universities;

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  const documents: ApplicationDocument[] = rawDocuments ?? [];
  const age = ageFromDob(app.date_of_birth);

  const initial: ApplicationFormValues = {
    full_name: s(app.full_name),
    email: s(app.email),
    phone: s(app.phone),
    date_of_birth: app.date_of_birth ? s(app.date_of_birth).slice(0, 10) : '',
    city: s(app.city),
    district: s(app.district),
    target_country: s(app.target_country),
    university_id: s(app.university_id),
    program: s(app.program),
    intake_season: s(app.intake_season),
    intake_year: s(app.intake_year),
    highest_education: s(app.highest_education),
    last_qualification: s(app.last_qualification),
    prior_institution: s(app.prior_institution),
    passing_year: s(app.passing_year),
    grading_system: s(app.grading_system),
    grade_value: s(app.grade_value),
    work_experience_years: s(app.work_experience_years),
    work_experience_detail: s(app.work_experience_detail),
    english_test: s(app.english_test),
    english_score: s(app.english_score),
    funding_source: s(app.funding_source),
    prior_rejection: app.prior_rejection === true,
    prior_rejection_detail: s(app.prior_rejection_detail),
    passport_number: s(app.passport_number),
    status: s(app.status),
  };

  return (
    <div className="space-y-6">
      <Link
        href={lead ? `/leads/${lead.id}` : '/applications'}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-tenant-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to {lead?.full_name || 'lead'}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-[0.1em] text-tenant-accent">
            <GraduationCap className="h-4 w-4" />
            {university ? `${university.name} (${university.country})` : 'No university set'}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="font-tenant-display text-2xl font-semibold text-tenant-ink">
              {app.full_name || '(no name)'}
            </h1>
            <Badge variant={STATUS_BADGE[app.status as LeadStatus]}>
              {STATUS_LABELS[app.status as LeadStatus]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Application #{app.application_number}
            {lead && (
              <>
                {' · '}
                Lead #{lead.lead_number} —{' '}
                <Link href={`/leads/${lead.id}`} className="underline hover:text-tenant-accent">
                  {lead.full_name}
                </Link>
              </>
            )}
            {' · '}Created {fmtDateTime(app.created_at)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ApplicationDetailToggle
            leadId={app.lead_id}
            applicationId={app.id}
            initial={initial}
            universities={universities ?? []}
          >
            <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
              <CardHeader>
                <CardTitle className="font-tenant-display">Contact &amp; location</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Email" value={app.email} />
                <Field label="Phone" value={app.phone} />
                <Field
                  label="Date of birth"
                  value={
                    app.date_of_birth
                      ? `${new Date(app.date_of_birth).toLocaleDateString('en-GB')}${age != null ? ` (age ${age})` : ''}`
                      : null
                  }
                />
                <Field label="City" value={app.city} />
                <Field label="District" value={app.district} />
                <Field label="Passport number" value={app.passport_number} />
              </CardContent>
            </Card>

            <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
              <CardHeader>
                <CardTitle className="font-tenant-display">Prior education &amp; experience</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Highest education" value={app.highest_education} />
                <Field label="Qualification" value={app.last_qualification} />
                <Field label="Institution attended" value={app.prior_institution} />
                <Field label="Passing year" value={app.passing_year} />
                <Field
                  label="Result"
                  value={
                    app.grade_value != null
                      ? `${app.grade_value}${app.grading_system ? ` — ${CODE_LABELS[app.grading_system] ?? app.grading_system}` : ''}`
                      : null
                  }
                />
                <Field
                  label="Work experience"
                  value={
                    app.work_experience_years != null
                      ? `${app.work_experience_years} yr${app.work_experience_years === 1 ? '' : 's'}${app.work_experience_detail ? ` — ${app.work_experience_detail}` : ''}`
                      : (app.work_experience_detail || null)
                  }
                />
              </CardContent>
            </Card>

            <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
              <CardHeader>
                <CardTitle className="font-tenant-display">Study goals</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Target country" value={app.target_country} />
                <Field
                  label="University"
                  value={university ? `${university.name} (${university.country})` : null}
                />
                <Field label="Program" value={app.program} />
                <Field
                  label="Intended intake"
                  value={
                    app.intake_season || app.intake_year
                      ? `${app.intake_season ? (CODE_LABELS[app.intake_season] ?? app.intake_season) : ''} ${app.intake_year ?? ''}`.trim()
                      : null
                  }
                />
                <Field
                  label="English test"
                  value={
                    app.english_test
                      ? `${CODE_LABELS[app.english_test] ?? app.english_test}${app.english_score != null ? ` — ${app.english_score}` : ''}`
                      : null
                  }
                />
                <Field
                  label="Funding"
                  value={app.funding_source ? (CODE_LABELS[app.funding_source] ?? app.funding_source) : null}
                />
                <Field label="Prior visa rejection" value={app.prior_rejection ? 'Yes' : 'No'} />
                {app.prior_rejection && (
                  <Field label="Rejection detail" value={app.prior_rejection_detail} />
                )}
              </CardContent>
            </Card>
          </ApplicationDetailToggle>

          <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
            <CardHeader>
              <CardTitle className="font-tenant-display">Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <DocumentsPanel applicationId={app.id} documents={documents} />
            </CardContent>
          </Card>

          <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
            <CardHeader>
              <CardTitle className="font-tenant-display">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ApplicationNoteComposer applicationId={app.id} />
              <div className="space-y-3">
                {(notes ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">No notes yet.</p>
                )}
                {(notes ?? []).map((n) => (
                  <div
                    key={n.id}
                    className="rounded-md border border-tenant-ink/10 bg-tenant-gray p-3"
                  >
                    <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {nameById.get(n.author_id) ?? 'Unknown'}
                      {emailById.get(n.author_id)
                        ? ` (${emailById.get(n.author_id)})`
                        : ''}{' '}
                      · {fmtDateTime(n.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
            <CardHeader>
              <CardTitle className="font-tenant-display">Manage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-tenant-accent">
                  Status
                </p>
                <ApplicationStatusChanger applicationId={app.id} current={app.status} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
            <CardHeader>
              <CardTitle className="font-tenant-display">Student upload link</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-xs text-muted-foreground">
                Send this to the student — it opens a page where they can upload documents
                for this application only, no login needed.
              </p>
              <UploadLinkCard
                applicationId={app.id}
                url={uploadUrl}
                expiresAt={app.document_upload_expires_at}
              />
            </CardContent>
          </Card>

          <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
            <CardHeader>
              <CardTitle className="font-tenant-display">Application actions</CardTitle>
            </CardHeader>
            <CardContent>
              <DeleteApplicationButton applicationId={app.id} leadId={app.lead_id} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
