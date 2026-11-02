import { VolumeLine } from '@/components/charts/dashboard-charts-lazy';
import { percentChange, type LeadReport } from '@/lib/reports/leads';
import { StatCard, Section, CountList, ReportTable } from './report-blocks';

function leadsHref(params: Record<string, string>) {
  return `/leads?${new URLSearchParams(params).toString()}`;
}

/**
 * Lead report body, shared by the monthly report (leads received in a
 * month — with a per-day chart) and the intake report (leads whose intended
 * intake is e.g. Sep–Oct 2027 — no chart, they arrived over many months).
 * `scope` is the /leads filter every number's link carries, so each one
 * opens exactly the leads it counted.
 */
export function LeadReportView({
  report,
  scope,
  totalLabel,
  previousCount,
  previousLabel,
  showDaily,
  navy,
}: {
  report: LeadReport;
  scope: Record<string, string>;
  totalLabel: string;
  previousCount: number;
  previousLabel: string;
  showDaily: boolean;
  navy: string;
}) {
  const link = (extra: Record<string, string> = {}) => leadsHref({ ...scope, ...extra });
  const change = percentChange(report.total, previousCount);
  const rejected = report.byStatus.find((s) => s.key === 'rejected')?.count ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={totalLabel}
          value={report.total}
          href={link()}
          hint={
            <>
              {previousCount} in {previousLabel}
              {change != null && (
                <span className={change >= 0 ? 'ml-1 text-emerald-600' : 'ml-1 text-red-600'}>
                  ({change >= 0 ? '+' : ''}
                  {change}%)
                </span>
              )}
            </>
          }
        />
        <StatCard
          label="Became applications"
          value={report.converted}
          hint={report.total ? `${Math.round((report.converted / report.total) * 100)}% of leads` : undefined}
        />
        <StatCard
          label="Contacted within 1h"
          value={`${report.responseRate}%`}
          hint="First status change within an hour"
          href={link()}
        />
        <StatCard
          label="Rejected"
          value={rejected}
          tone={rejected ? 'bad' : undefined}
          href={link({ status: 'rejected' })}
        />
      </div>

      {showDaily && (
        <Section title="Leads per day" hint="Click a day to open its leads">
          <VolumeLine
            navy={navy}
            data={report.daily.map((d) => ({ label: d.label, value: d.count, href: leadsHref({ from: d.key, to: d.key }) }))}
          />
        </Section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="By source">
          <CountList
            empty="No leads."
            rows={report.bySource.map((s) => ({ label: s.label, count: s.count, href: link({ source: s.key }) }))}
          />
        </Section>
        <Section title="By current status">
          <CountList
            rows={report.byStatus.map((s) => ({
              label: s.label,
              count: s.count,
              muted: s.count === 0,
              href: link({ status: s.key }),
            }))}
          />
        </Section>
      </div>

      <Section title="By staff member" hint="Who added each lead — public-form leads are grouped separately">
        <ReportTable
          columns={['Staff', 'Leads', 'Contacted < 1h', 'Became applications']}
          empty="No leads."
          rows={report.byStaff.map((s) => ({
            key: s.key,
            href: link({ staff: s.key }),
            cells: [s.label, s.count, s.fastResponses, s.converted],
          }))}
        />
      </Section>
    </div>
  );
}
