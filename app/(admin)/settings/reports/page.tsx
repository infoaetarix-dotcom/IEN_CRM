import Link from 'next/link';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import { getOrgBrand } from '@/lib/branding/org';
import { resolveTheme } from '@/lib/branding/themes';
import { PageHeader } from '@/components/dashboard/page-header';
import { Badge } from '@/components/ui/badge';
import { ReportPicker } from '@/components/dashboard/reports/report-picker';
import { LeadReportView } from '@/components/dashboard/reports/lead-report-view';
import { IntakeReportView } from '@/components/dashboard/reports/intake-report-view';
import { getReportingSettings } from '@/lib/reports/settings';
import { loadLeadReport, countLeads, loadIntakeReport, loadIntakeOptions } from '@/lib/reports/load';
import { resolveReportSelection } from '@/lib/reports/selection';
import { periodMonthsLabel, zonedYMD } from '@/lib/reports/time';

export const metadata = { title: 'Reports' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Settings → Reports. One report at a time, chosen from a single row of
 * controls (no tabs): monthly leads, a reporting period's leads (periods
 * set in Settings → Reporting periods), or an application intake. Visible
 * to everyone in the consultancy.
 */
export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const profile = await requireUser();
  const sp = await searchParams;

  const [brand, settings, intakeInfo] = await Promise.all([
    getOrgBrand(profile.organization_id),
    getReportingSettings(profile.organization_id!),
    loadIntakeOptions(),
  ]);
  const theme = resolveTheme(brand.themeKey);
  const tz = settings.timezone;
  const now = new Date();
  const thisYear = zonedYMD(now, tz).year;

  const selection = resolveReportSelection(sp, {
    tz,
    now,
    periods: settings.periods,
    intakes: intakeInfo.options,
  });

  // Years offered in the picker: a few either side of now, plus any year
  // that has intake data.
  const years = [
    ...new Set([
      ...Array.from({ length: 6 }, (_, i) => thisYear - 3 + i),
      ...intakeInfo.options.map((o) => o.year),
      selection.year,
    ]),
  ].sort((a, b) => b - a);

  const exportQuery = new URLSearchParams();
  exportQuery.set('type', selection.type);
  if (selection.type === 'monthly') exportQuery.set('month', `${selection.year}-${String(selection.month).padStart(2, '0')}`);
  if (selection.type === 'period' && selection.period) {
    exportQuery.set('period', selection.period.id);
    exportQuery.set('year', String(selection.year));
  }
  if (selection.type === 'intake') {
    exportQuery.set('season', selection.season);
    exportQuery.set('year', String(selection.year));
  }
  const canExport = selection.type !== 'period' || !!selection.period;

  // Fetch the chosen report (and its comparison) in parallel.
  const leadRange =
    selection.type === 'monthly' || (selection.type === 'period' && selection.period)
      ? { range: selection.range, previous: selection.previous }
      : null;
  const [leadReport, previousCount, intakeReport, previousIntake] = await Promise.all([
    leadRange ? loadLeadReport(leadRange.range, tz) : null,
    leadRange ? countLeads(leadRange.previous) : 0,
    selection.type === 'intake' ? loadIntakeReport(selection.season, selection.year) : null,
    selection.type === 'intake' ? loadIntakeReport(selection.season, selection.year - 1) : null,
  ]);

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-tenant-ink">
        <ArrowLeft className="h-4 w-4" /> Settings
      </Link>
      <PageHeader
        icon={BarChart3}
        title="Reports"
        subtitle="Leads by month or reporting period, and applications by intake."
      />

      <ReportPicker
        type={selection.type}
        month={selection.type === 'monthly' ? `${selection.year}-${String(selection.month).padStart(2, '0')}` : ''}
        periods={settings.periods.map((p) => ({ id: p.id, label: `${p.name} (${periodMonthsLabel(p)})` }))}
        periodId={selection.type === 'period' && selection.period ? selection.period.id : ''}
        year={selection.year}
        season={selection.type === 'intake' ? selection.season : ''}
        years={years}
        exportHref={canExport ? `/api/reports/export?${exportQuery.toString()}` : null}
      />

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-tenant-display text-xl font-semibold text-tenant-ink">{selection.title}</h2>
        {selection.type === 'period' && selection.period && (
          <Badge variant={selection.final ? 'success' : 'neutral'}>
            {selection.final
              ? 'Final'
              : `In progress · final from ${selection.reportDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz })}`}
          </Badge>
        )}
      </div>

      {selection.type === 'monthly' && (
        <LeadReportView
          report={leadReport!}
          range={selection.range}
          tz={tz}
          previousCount={previousCount}
          previousLabel={selection.previousLabel}
          accent={theme.tokens.accent}
          navy={theme.tokens.navy}
        />
      )}

      {selection.type === 'period' &&
        (selection.period ? (
          <LeadReportView
            report={leadReport!}
            range={selection.range}
            tz={tz}
            previousCount={previousCount}
            previousLabel={selection.previousLabel}
            accent={theme.tokens.accent}
            navy={theme.tokens.navy}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-tenant-ink/20 bg-white p-8 text-center text-sm text-muted-foreground">
            No reporting periods yet. Set them up in{' '}
            <Link href="/settings" className="text-tenant-accent underline">
              Settings → Reporting periods
            </Link>
            .
          </p>
        ))}

      {selection.type === 'intake' && (
        <IntakeReportView
          report={intakeReport!}
          previous={previousIntake!}
          season={selection.season}
          year={selection.year}
          title={selection.title}
          previousLabel={selection.previousLabel}
          withoutIntake={intakeInfo.withoutIntake}
        />
      )}
    </div>
  );
}
