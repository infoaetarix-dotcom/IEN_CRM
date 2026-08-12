import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { ageFromDob } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from '@/components/ui/card';
import {
  StatusChanger,
  NoteComposer,
  EmailPanel,
} from '@/components/dashboard/lead-controls';
import {
  LeadDetailsEditor,
  type LeadEditState,
} from '@/components/dashboard/lead-editor';
import { LeadActions } from '@/components/dashboard/lead-archive-controls';
import {
  STATUS_LABELS,
  STATUS_BADGE,
  SOURCE_LABELS,
  type LeadStatus,
  type LeadSource,
} from '@/lib/leads/display';
import { CODE_LABELS } from '@/lib/form-options';

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

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();
  const supabase = await createClient();

  // Independent reads — the lead row itself doesn't gate any of the others
  // (they all just filter by the route's `id`), so every query fires together
  // instead of the lead row blocking the rest.
  const [leadRes, notesRes, historyRes, messagesRes, profilesRes, templatesRes, applicationsRes] =
    await Promise.all([
      supabase.from('leads').select('*').eq('id', id).single(),
      supabase
        .from('lead_notes')
        .select('id, body, author_id, created_at')
        .eq('lead_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('lead_status_history')
        .select('id, from_status, to_status, changed_by, changed_at')
        .eq('lead_id', id)
        .order('changed_at', { ascending: false }),
      supabase
        .from('messages')
        .select('id, subject, status, template_key, sent_by, created_at, error_detail')
        .eq('lead_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, email, is_active'),
      supabase
        .from('email_templates')
        .select('key, name, subject, body')
        .order('is_auto', { ascending: false }),
      supabase
        .from('applications')
        .select('id, application_number, status')
        .eq('lead_id', id)
        .order('application_number', { ascending: true }),
    ]);

  const lead = leadRes.data;
  if (!lead) notFound();

  const nameById = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p.full_name]),
  );
  const emailById = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p.email]),
  );
  const age = ageFromDob(lead.date_of_birth);

  // Shared-data model: RLS (leads_update / leads_delete) allows any active
  // org member to edit or delete any lead in their org, not just admins or
  // the assigned agent.
  const canEdit = true;
  const isArchived = lead.archived_at != null;
  const canDelete = true;
  const archivedByName = lead.archived_by
    ? (nameById.get(lead.archived_by) ?? 'Unknown')
    : null;

  const s = (v: unknown) => (v == null ? '' : String(v));
  const initial: LeadEditState = {
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
  };

  return (
    <div className="space-y-6">
      <Link
        href="/leads"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-tenant-accent"
      >
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-tenant-display text-2xl font-semibold text-tenant-ink">
              {lead.full_name || '(no name)'}
            </h1>
            <Badge variant={STATUS_BADGE[lead.status as LeadStatus]}>
              {STATUS_LABELS[lead.status as LeadStatus]}
            </Badge>
            {lead.is_complete === false && (
              <Badge variant="warning">Incomplete application</Badge>
            )}
            {isArchived && <Badge variant="neutral">Archived</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Received {fmtDateTime(lead.created_at)} ·{' '}
            <Badge variant="outline">
              {SOURCE_LABELS[lead.utm_source as LeadSource]}
              {lead.utm_medium ? ` / ${lead.utm_medium}` : ''}
            </Badge>
          </p>
        </div>
      </div>

      {lead.is_complete === false && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Incomplete application.</strong> This applicant started but
          didn&apos;t finish the form — their contact details are captured.
          Follow up to help them complete it.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: profile + notes */}
        <div className="space-y-6 lg:col-span-2">
          <LeadDetailsEditor
            leadId={lead.id}
            canEdit={canEdit}
            initial={initial}
          >
          <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
            <CardHeader>
              <CardTitle className="font-tenant-display">Contact &amp; location</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Email" value={lead.email} />
              <Field label="Phone" value={lead.phone} />
              <Field
                label="Date of birth"
                value={
                  lead.date_of_birth
                    ? `${new Date(lead.date_of_birth).toLocaleDateString('en-GB')}${age != null ? ` (age ${age})` : ''}`
                    : null
                }
              />
              <Field label="City" value={lead.city} />
              <Field label="District" value={lead.district} />
              <Field
                label="Consent"
                value={
                  lead.consent_given
                    ? `Given ${lead.consent_at ? fmtDateTime(lead.consent_at) : ''}`
                    : 'Not given'
                }
              />
            </CardContent>
          </Card>

          <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
            <CardHeader>
              <CardTitle className="font-tenant-display">Prior education &amp; experience</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Highest education" value={lead.highest_education} />
              <Field label="Qualification" value={lead.last_qualification} />
              <Field label="Institution attended" value={lead.prior_institution} />
              <Field label="Passing year" value={lead.passing_year} />
              <Field
                label="Result"
                value={
                  lead.grade_value != null
                    ? `${lead.grade_value}${lead.grading_system ? ` — ${CODE_LABELS[lead.grading_system] ?? lead.grading_system}` : ''}`
                    : null
                }
              />
              <Field
                label="Work experience"
                value={
                  lead.work_experience_years != null
                    ? `${lead.work_experience_years} yr${lead.work_experience_years === 1 ? '' : 's'}${lead.work_experience_detail ? ` — ${lead.work_experience_detail}` : ''}`
                    : (lead.work_experience_detail || null)
                }
              />
            </CardContent>
          </Card>

          <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
            <CardHeader>
              <CardTitle className="font-tenant-display">Study goals</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Field label="Target country" value={lead.target_country} />
              <Field label="Preferred institution" value={lead.institution} />
              <Field label="Program" value={lead.program} />
              <Field
                label="Intended intake"
                value={
                  lead.intake_season || lead.intake_year
                    ? `${lead.intake_season ? (CODE_LABELS[lead.intake_season] ?? lead.intake_season) : ''} ${lead.intake_year ?? ''}`.trim()
                    : null
                }
              />
              <Field
                label="English test"
                value={
                  lead.english_test
                    ? `${CODE_LABELS[lead.english_test] ?? lead.english_test}${lead.english_score != null ? ` — ${lead.english_score}` : ''}`
                    : null
                }
              />
              <Field
                label="Funding"
                value={
                  lead.funding_source
                    ? (CODE_LABELS[lead.funding_source] ?? lead.funding_source)
                    : null
                }
              />
              <Field
                label="Prior visa rejection"
                value={lead.prior_rejection ? 'Yes' : 'No'}
              />
              {lead.prior_rejection && (
                <Field
                  label="Rejection detail"
                  value={lead.prior_rejection_detail}
                />
              )}
            </CardContent>
          </Card>

          </LeadDetailsEditor>

          <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="font-tenant-display">Applications</CardTitle>
              <Link
                href={`/applications/new?lead_id=${lead.id}`}
                className="inline-flex h-8 items-center gap-1 rounded-md bg-tenant-accent px-2.5 text-xs text-white hover:bg-tenant-accent/90"
              >
                <Plus className="h-3.5 w-3.5" /> Create application
              </Link>
            </CardHeader>
            <CardContent>
              {(applicationsRes.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No applications yet for this lead.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {(applicationsRes.data ?? []).map((a, i) => (
                    <Link
                      key={a.id}
                      href={`/applications/${a.id}`}
                      className="rounded-lg border border-tenant-ink/10 p-3 transition-colors hover:border-tenant-accent hover:bg-tenant-gray"
                    >
                      <p className="text-sm font-medium text-tenant-ink">
                        Application {i + 1}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        #{a.application_number}
                      </p>
                      <Badge
                        variant={STATUS_BADGE[a.status as LeadStatus]}
                        className="mt-2"
                      >
                        {STATUS_LABELS[a.status as LeadStatus]}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
            <CardHeader>
              <CardTitle className="font-tenant-display">Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <NoteComposer leadId={lead.id} />
              <div className="space-y-3">
                {(notesRes.data ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground">No notes yet.</p>
                )}
                {(notesRes.data ?? []).map((n) => (
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

        {/* Right: actions + histories */}
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
                <StatusChanger leadId={lead.id} current={lead.status} />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
            <CardHeader>
              <CardTitle className="font-tenant-display">Send email</CardTitle>
            </CardHeader>
            <CardContent>
              {(templatesRes.data ?? []).length > 0 ? (
                <EmailPanel
                  leadId={lead.id}
                  templates={templatesRes.data ?? []}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  No templates available.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
            <CardHeader>
              <CardTitle className="font-tenant-display">Message history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(messagesRes.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No messages sent.
                </p>
              )}
              {(messagesRes.data ?? []).map((m) => (
                <div key={m.id} className="text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{m.subject ?? m.template_key}</span>
                    <Badge
                      variant={
                        m.status === 'sent'
                          ? 'success'
                          : m.status === 'failed'
                            ? 'danger'
                            : 'neutral'
                      }
                    >
                      {m.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {m.sent_by ? (nameById.get(m.sent_by) ?? 'Staff') : 'System'}{' '}
                    · {fmtDateTime(m.created_at)}
                  </p>
                  {m.error_detail && (
                    <p className="text-xs text-destructive">{m.error_detail}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
            <CardHeader>
              <CardTitle className="font-tenant-display">Status history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(historyRes.data ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No changes yet.</p>
              )}
              {(historyRes.data ?? []).map((h) => (
                <div key={h.id} className="text-sm">
                  <span>
                    {h.from_status
                      ? `${STATUS_LABELS[h.from_status as LeadStatus]} → `
                      : ''}
                    <strong>{STATUS_LABELS[h.to_status as LeadStatus]}</strong>
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {h.changed_by ? (nameById.get(h.changed_by) ?? 'Staff') : 'System'}{' '}
                    · {fmtDateTime(h.changed_at)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
            <CardHeader>
              <CardTitle className="font-tenant-display">Lead actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isArchived && (
                <p className="text-xs text-muted-foreground">
                  Archived{archivedByName ? ` by ${archivedByName}` : ''}
                  {lead.archived_at ? ` · ${fmtDateTime(lead.archived_at)}` : ''}
                </p>
              )}
              <LeadActions
                leadId={lead.id}
                isArchived={isArchived}
                canArchive={canEdit}
                canDelete={canDelete}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
