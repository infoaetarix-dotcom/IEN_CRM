import Link from 'next/link';
import { APPLICATION_STAGES, APPLICATION_STAGE_LABELS } from '@/lib/leads/display';
import { applicationsHref, NONE } from '@/lib/applications/list-filters';
import type { IntakeReport } from '@/lib/reports/applications';
import { StatCard, Section, CountList, ReportTable } from './report-blocks';

/**
 * Application intake report body: the admissions funnel for one intake
 * season — offers, deposits, visas, enrolment — with each number opening
 * the applications it counts.
 */
export function IntakeReportView({
  report,
  season,
  year,
  title,
  previous,
  previousLabel,
  withoutIntake,
}: {
  report: IntakeReport;
  season: string;
  year: number;
  title: string;
  previous: IntakeReport;
  previousLabel: string;
  withoutIntake: number;
}) {
  const href = (statuses: readonly string[] | undefined, label: string, extra: { university?: string | null; country?: string | null } = {}) =>
    applicationsHref({ season, year, statuses, label: `${title} · ${label}`, ...extra });
  const prevOf = (key: string) => previous.milestones.find((m) => m.key === key)?.count ?? 0;

  return (
    <div className="space-y-4">
      {withoutIntake > 0 && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
          {withoutIntake} application{withoutIntake === 1 ? ' has' : 's have'} no intake set, so{' '}
          {withoutIntake === 1 ? 'it isn’t' : 'they aren’t'} in any intake report.{' '}
          <Link href={applicationsHref({ season: NONE, label: 'No intake set' })} className="font-medium underline">
            Review them
          </Link>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {report.milestones.map((m) => (
          <StatCard
            key={m.key}
            label={m.label}
            value={m.count}
            tone={m.tone === 'bad' && m.count ? 'bad' : undefined}
            href={m.count ? href(m.key === 'generated' ? undefined : m.statuses, m.label) : undefined}
            hint={`${prevOf(m.key)} in ${previousLabel}`}
          />
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatCard
          label="Visa success rate"
          value={report.visaSuccessRate == null ? '—' : `${report.visaSuccessRate}%`}
          tone={report.visaSuccessRate == null ? undefined : report.visaSuccessRate >= 50 ? 'good' : 'bad'}
          hint={
            report.visaSuccessRate == null
              ? 'No visa decisions yet'
              : 'Accepted ÷ (accepted + rejected)'
          }
        />
        <StatCard
          label="Total applications"
          value={report.total}
          hint={`${previous.total} for ${previousLabel}`}
          href={report.total ? href(undefined, 'All applications') : undefined}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {APPLICATION_STAGES.map((stage) => {
          const rows = report.byStatus.filter((s) => s.stage === stage);
          return (
            <Section key={stage} title={`${APPLICATION_STAGE_LABELS[stage]} stage`} hint="Where each application is now">
              <CountList
                rows={rows.map((s) => ({
                  label: s.label,
                  count: s.count,
                  muted: s.count === 0,
                  href: href([s.status], s.label),
                }))}
              />
            </Section>
          );
        })}
      </div>

      <Section title="By university">
        <ReportTable
          columns={['University', 'Applications', 'Visa applied', 'Visa accepted', 'Visa rejected']}
          empty="No applications for this intake."
          rows={report.byUniversity.map((r) => ({
            key: r.label,
            href: href(undefined, r.label, { university: r.label === 'No university' ? null : r.label }),
            cells: [r.label, r.total, r.visaApplied, r.visaAccepted, r.visaRejected],
          }))}
        />
      </Section>

      <Section title="By country">
        <ReportTable
          columns={['Country', 'Applications', 'Visa applied', 'Visa accepted', 'Visa rejected']}
          empty="No applications for this intake."
          rows={report.byCountry.map((r) => ({
            key: r.label,
            href: href(undefined, r.label, { country: r.label === 'Unknown' ? null : r.label }),
            cells: [r.label, r.total, r.visaApplied, r.visaAccepted, r.visaRejected],
          }))}
        />
      </Section>
    </div>
  );
}
