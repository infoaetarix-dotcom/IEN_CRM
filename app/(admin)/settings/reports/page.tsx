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
import {
  loadLeadReport,
  countLeads,
  loadIntakeReport,
  loadIntakeLeadReport,
  countIntakeLeads,
  loadIntakeOptions,
} from '@/lib/reports/load';
import { rangeDateBounds } from '@/lib/reports/leads';
import { resolveReportSelection } from '@/lib/reports/selection';
import { zonedYMD } from '@/lib/reports/time';

export const metadata = { title: 'Reports' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Settings → Reports. One report at a time, chosen from a single row of
 * controls (no tabs): leads received in a month, or an intake (Jan–Feb /
 * Apr–May / Sep–Oct) — the leads aiming for it plus its applications'
 * admissions funnel. Intakes come straight from each record's intake
 * field; there's nothing to set up. Visible to everyone in the consultancy.
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

  const selection = resolveReportSelection(sp, { tz, now, intakes: intakeInfo.options });

  // Years offered in the picker: a few either side of now, plus any year
  // that has intake data.
  const years = [
    ...new Set([
      ...Array.from({ length: 7 }, (_, i) => thisYear - 3 + i),
      ...intakeInfo.options.map((o) => o.year),
      selection.year,
    ]),
  ].sort((a, b) => b - a);

  const exportQuery = new URLSearchParams({ type: selection.type });
  if (selection.type === 'monthly') {
    exportQuery.set('month', `${selection.year}-${String(selection.month).padStart(2, '0')}`);
  } else {
    exportQuery.set('season', selection.season);
    exportQuery.set('year', String(selection.year));
  }

  // Fetch the chosen report and its comparison in parallel.
  const isIntake = selection.type === 'intake';
  const [monthly, monthlyPrevious, intakeLeads, intakeLeadsPrevious, intakeApps, intakeAppsPrevious] =
    await Promise.all([
      !isIntake ? loadLeadReport(selection.range, tz) : null,
      !isIntake ? countLeads(selection.previous) : 0,
      isIntake ? loadIntakeLeadReport(selection.season, selection.year, tz) : null,
      isIntake ? countIntakeLeads(selection.season, selection.year - 1) : 0,
      isIntake ? loadIntakeReport(selection.season, selection.year) : null,
      isIntake ? loadIntakeReport(selection.season, selection.year - 1) : null,
    ]);

  return (
    <div className="space-y-6">
      <Link href="/settings" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-tenant-ink">
        <ArrowLeft className="h-4 w-4" /> Settings
      </Link>
      <PageHeader
        icon={BarChart3}
        title="Reports"
        subtitle="Leads by month, and leads and applications by intake."
      />

      <ReportPicker
        type={selection.type}
        month={selection.type === 'monthly' ? `${selection.year}-${String(selection.month).padStart(2, '0')}` : ''}
        year={selection.year}
        season={isIntake ? selection.season : ''}
        years={years}
        exportHref={`/api/reports/export?${exportQuery.toString()}`}
      />

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-tenant-display text-xl font-semibold text-tenant-ink">{selection.title}</h2>
        {selection.type === 'intake' && (
          <Badge variant={selection.final ? 'success' : 'neutral'}>
            {selection.final
              ? 'Final'
              : `In progress · final from ${selection.reportDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: tz })}`}
          </Badge>
        )}
      </div>

      {selection.type === 'monthly' && monthly && (
        <LeadReportView
          report={monthly}
          scope={rangeDateBounds(selection.range, tz)}
          totalLabel="Leads received"
          previousCount={monthlyPrevious}
          previousLabel={selection.previousLabel}
          showDaily
          navy={theme.tokens.navy}
        />
      )}

      {selection.type === 'intake' && intakeLeads && intakeApps && intakeAppsPrevious && (
        <>
          <section className="space-y-3">
            <h3 className="font-tenant-display text-lg font-semibold text-tenant-ink">Leads for this intake</h3>
            {intakeInfo.withoutIntake.leads > 0 && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
                {intakeInfo.withoutIntake.leads} lead{intakeInfo.withoutIntake.leads === 1 ? ' has' : 's have'} no
                intake set, so {intakeInfo.withoutIntake.leads === 1 ? 'it isn’t' : 'they aren’t'} in any intake
                report.{' '}
                <Link href="/leads?season=__none" className="font-medium underline">
                  Review them
                </Link>
              </p>
            )}
            <LeadReportView
              report={intakeLeads}
              scope={{ season: selection.season, year: String(selection.year) }}
              totalLabel="Leads for this intake"
              previousCount={intakeLeadsPrevious}
              previousLabel={selection.previousLabel}
              showDaily={false}
              navy={theme.tokens.navy}
            />
          </section>

          <section className="space-y-3">
            <h3 className="font-tenant-display text-lg font-semibold text-tenant-ink">Applications for this intake</h3>
            <IntakeReportView
              report={intakeApps}
              previous={intakeAppsPrevious}
              season={selection.season}
              year={selection.year}
              title={selection.title}
              previousLabel={selection.previousLabel}
              withoutIntake={intakeInfo.withoutIntake.applications}
            />
          </section>
        </>
      )}
    </div>
  );
}
