import { SourceBar, VolumeLine } from '@/components/charts/dashboard-charts-lazy';
import { percentChange, rangeDateBounds, type LeadReport } from '@/lib/reports/leads';
import type { Range } from '@/lib/reports/time';
import { StatCard, Section, CountList, ReportTable } from './report-blocks';

function leadsHref(params: Record<string, string>) {
  return `/leads?${new URLSearchParams(params).toString()}`;
}

/**
 * Lead report body — the monthly report and the reporting-period report
 * show the same numbers over different ranges. A period spanning several
 * months adds a per-month chart; a single month shows each day.
 */
export function LeadReportView({
  report,
  range,
  tz,
  previousCount,
  previousLabel,
  accent,
  navy,
}: {
  report: LeadReport;
  range: Range;
  tz: string;
  previousCount: number;
  previousLabel: string;
  accent: string;
  navy: string;
}) {
  const { from, to } = rangeDateBounds(range, tz);
  const inRange = (extra: Record<string, string> = {}) => leadsHref({ from, to, ...extra });
  const change = percentChange(report.total, previousCount);
  const rejected = report.byStatus.find((s) => s.key === 'rejected')?.count ?? 0;
  const multiMonth = report.monthly.length > 1;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Leads received"
          value={report.total}
          href={inRange()}
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
          href={inRange()}
        />
        <StatCard
          label="Rejected"
          value={rejected}
          tone={rejected ? 'bad' : undefined}
          href={inRange({ status: 'rejected' })}
        />
      </div>

      {multiMonth ? (
        <Section title="Leads per month" hint="Click a month to open its leads">
          <SourceBar
            accent={accent}
            data={report.monthly.map((m) => {
              const [y, mo] = m.key.split('-');
              const lastDay = new Date(Date.UTC(Number(y), Number(mo), 0)).getUTCDate();
              return {
                label: m.label,
                value: m.count,
                href: leadsHref({ from: `${m.key}-01`, to: `${m.key}-${String(lastDay).padStart(2, '0')}` }),
              };
            })}
          />
        </Section>
      ) : (
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
            empty="No leads in this period."
            rows={report.bySource.map((s) => ({ label: s.label, count: s.count, href: inRange({ source: s.key }) }))}
          />
        </Section>
        <Section title="By current status">
          <CountList
            rows={report.byStatus.map((s) => ({
              label: s.label,
              count: s.count,
              muted: s.count === 0,
              href: inRange({ status: s.key }),
            }))}
          />
        </Section>
      </div>

      <Section title="By staff member" hint="Who added each lead — public-form leads are grouped separately">
        <ReportTable
          columns={['Staff', 'Leads', 'Contacted < 1h', 'Became applications']}
          empty="No leads in this period."
          rows={report.byStaff.map((s) => ({
            key: s.key,
            href: inRange({ staff: s.key }),
            cells: [s.label, s.count, s.fastResponses, s.converted],
          }))}
        />
      </Section>
    </div>
  );
}
