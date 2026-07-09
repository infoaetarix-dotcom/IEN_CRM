import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
  AssignControl,
  NoteComposer,
  EmailPanel,
} from '@/components/dashboard/lead-controls';
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
      <p className="label-eyebrow">{label}</p>
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
  const profile = await requireUser();
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .single();
  if (!lead) notFound();

  const [notesRes, historyRes, messagesRes, profilesRes, templatesRes] =
    await Promise.all([
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
      supabase.from('profiles').select('id, full_name, is_active'),
      supabase
        .from('email_templates')
        .select('key, name, subject, body')
        .order('is_auto', { ascending: false }),
    ]);

  const nameById = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p.full_name]),
  );
  const agents = (profilesRes.data ?? [])
    .filter((p) => p.is_active)
    .map((p) => ({ id: p.id, full_name: p.full_name }));
  const age = ageFromDob(lead.date_of_birth);

  return (
    <div className="space-y-6">
      <Link
        href="/leads"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-2xl">{lead.full_name}</h1>
            <Badge variant={STATUS_BADGE[lead.status as LeadStatus]}>
              {STATUS_LABELS[lead.status as LeadStatus]}
            </Badge>
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

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: profile + notes */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Contact &amp; location</CardTitle>
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

          <Card>
            <CardHeader>
              <CardTitle>Prior education &amp; experience</CardTitle>
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

          <Card>
            <CardHeader>
              <CardTitle>Study goals</CardTitle>
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

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
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
                    className="rounded-md border border-line bg-secondary/20 p-3"
                  >
                    <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {nameById.get(n.author_id) ?? 'Unknown'} ·{' '}
                      {fmtDateTime(n.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: actions + histories */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Manage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="label-eyebrow mb-1">Status</p>
                <StatusChanger leadId={lead.id} current={lead.status} />
              </div>
              {profile.role === 'admin' && (
                <div>
                  <p className="label-eyebrow mb-1">Assigned agent</p>
                  <AssignControl
                    leadId={lead.id}
                    current={lead.assigned_to}
                    agents={agents}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Send email</CardTitle>
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

          <Card>
            <CardHeader>
              <CardTitle>Message history</CardTitle>
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

          <Card>
            <CardHeader>
              <CardTitle>Status history</CardTitle>
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
        </div>
      </div>
    </div>
  );
}
