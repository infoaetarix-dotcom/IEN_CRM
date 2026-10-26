import Link from 'next/link';
import { ArrowUpRight, CalendarClock, LayoutDashboard } from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getOrgBrand } from '@/lib/branding/org';
import { resolveTheme } from '@/lib/branding/themes';
import { getReportingSettings } from '@/lib/reports/settings';
import { countDueFollowUps } from '@/lib/follow-ups/load';
import { zonedYMD, zonedDateKey, ymdKey, startOfDayInZone, monthName } from '@/lib/reports/time';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/dashboard/page-header';
import { SourceBar, PipelineBar, VolumeLine } from '@/components/charts/dashboard-charts-lazy';
import {
  buildSourceData,
  buildPipelineData,
  buildVolumeData,
  computeResponseRate,
} from '@/lib/leads/metrics';
import {
  STATUS_LABELS,
  STATUS_BADGE,
  SOURCE_LABELS,
  type LeadStatus,
  type LeadSource,
} from '@/lib/leads/display';

export const metadata = { title: 'Dashboard' };

// Window for the lead-volume chart; also drives its title.
const VOLUME_DAYS = 30;

/** Clicking a card opens the leads list filtered to exactly what it counts. */
function MetricCard({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href: string;
}) {
  return (
    <Link href={href} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tenant-accent">
      <Card className="h-full rounded-xl border-tenant-ink/10 shadow-sm transition-colors group-hover:border-tenant-accent/40 group-hover:bg-tenant-accent/[0.03]">
        <CardContent className="p-5">
          <p className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.16em] text-tenant-accent">
            {label}
            <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
          </p>
          <p className="mt-2 font-tenant-display text-3xl font-semibold text-tenant-ink">
            {value}
          </p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </CardContent>
      </Card>
    </Link>
  );
}

function leadsHref(params: Record<string, string>) {
  return `/leads?${new URLSearchParams(params).toString()}`;
}

export default async function DashboardPage() {
  const profile = await requireUser();
  const supabase = await createClient();

  // Independent reads (brand lookup + two org-scoped queries) — fired together
  // instead of one-after-another so the page waits for the slowest of the
  // three round-trips, not their sum.
  const [brand, { timezone: tz }, { data: leads }, { data: statusHistory }] = await Promise.all([
    getOrgBrand(profile.organization_id),
    getReportingSettings(profile.organization_id!),
    supabase
      .from('leads')
      .select('id, full_name, status, utm_source, created_at')
      .is('archived_at', null)
      .order('created_at', { ascending: false }),
    // First status change per lead (any transition off the default
    // raw_lead stage counts as "acted on"), for response-rate.
    supabase
      .from('lead_status_history')
      .select('lead_id, changed_at')
      .order('changed_at', { ascending: true }),
  ]);
  const theme = resolveTheme(brand.themeKey);

  // "Today" and "this month" follow the consultancy's own clock (Settings →
  // Reporting), not the server's UTC one.
  const now = new Date();
  const today = zonedYMD(now, tz);
  const todayKey = ymdKey(today);
  const monthStartKey = ymdKey({ ...today, day: 1 });
  const startOfMonth = startOfDayInZone(tz, today.year, today.month, 1);
  const startOfToday = startOfDayInZone(tz, today.year, today.month, today.day);
  const last30 = startOfDayInZone(tz, today.year, today.month, today.day - 29);
  const last30Key = zonedDateKey(last30, tz);

  // RLS scopes these to the caller's organization (shared across admin + agents).
  const all = leads ?? [];

  const firstContact = new Map<string, string>();
  for (const h of statusHistory ?? []) {
    if (!firstContact.has(h.lead_id)) firstContact.set(h.lead_id, h.changed_at);
  }

  const totalThisMonth = all.filter(
    (l) => new Date(l.created_at) >= startOfMonth,
  ).length;
  // "Unworked" = still sitting in the default raw_lead stage — status has
  // collapsed 'new'/'contacted' into one bucket (see 0034_lead_status_v2.sql),
  // so this is the closest equivalent.
  const newToday = all.filter(
    (l) => l.status === 'raw_lead' && new Date(l.created_at) >= startOfToday,
  ).length;
  const sourceData = buildSourceData(all).map((d) => ({ ...d, href: leadsHref({ source: d.key! }) }));
  const pipelineData = buildPipelineData(all).map((d) => ({ ...d, href: leadsHref({ status: d.key! }) }));
  const volumeData = buildVolumeData(all, VOLUME_DAYS, now, tz).map((d) => ({
    ...d,
    href: leadsHref({ from: d.key!, to: d.key! }),
  }));
  const recentLeadsIn30 = all.filter((l) => new Date(l.created_at) >= last30);
  const response = computeResponseRate(recentLeadsIn30, firstContact);
  const recent = all.slice(0, 6);
  const followUps = await countDueFollowUps(todayKey);
  const followUpsDue =
    followUps.today.leads + followUps.today.applications + followUps.overdue.leads + followUps.overdue.applications;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title={`Welcome back, ${profile.full_name.split(' ')[0]}`}
        subtitle="Your consultancy's leads at a glance"
      />

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Leads this month"
          value={totalThisMonth}
          hint={monthName(today.month) + ' ' + today.year}
          href={leadsHref({ from: monthStartKey, to: todayKey })}
        />
        <MetricCard
          label="New today (unworked)"
          value={newToday}
          href={leadsHref({ status: 'raw_lead', from: todayKey, to: todayKey })}
        />
        <MetricCard
          label="Response rate < 1h"
          value={response.rate == null ? '—' : `${response.rate}%`}
          hint={
            response.rate == null
              ? 'No leads in last 30 days'
              : `${response.within} of ${response.denom} (last 30 days)`
          }
          href={leadsHref({ from: last30Key, to: todayKey })}
        />
        <MetricCard
          label="Active sources"
          value={sourceData.length}
          hint="All leads, by source"
          href="/leads"
        />
      </div>

      {followUpsDue > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-2 font-medium text-amber-900">
            <CalendarClock className="h-4 w-4" />
            {followUps.today.leads + followUps.today.applications} follow-up
            {followUps.today.leads + followUps.today.applications === 1 ? '' : 's'} due today
            {followUps.overdue.leads + followUps.overdue.applications > 0 && (
              <span className="text-red-600">
                · {followUps.overdue.leads + followUps.overdue.applications} overdue
              </span>
            )}
          </span>
          <span className="flex flex-wrap gap-3">
            <Link href="/leads?followup=any" className="text-tenant-accent hover:underline">
              Leads ({followUps.today.leads + followUps.overdue.leads})
            </Link>
            <Link href="/applications?followup=any" className="text-tenant-accent hover:underline">
              Applications ({followUps.today.applications + followUps.overdue.applications})
            </Link>
          </span>
        </div>
      )}

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
          <CardHeader>
            <CardTitle className="font-tenant-display">Leads by source</CardTitle>
            <p className="text-xs text-muted-foreground">Click a bar to open those leads</p>
          </CardHeader>
          <CardContent>
            {sourceData.length ? (
              <SourceBar data={sourceData} accent={theme.tokens.accent} />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                No data yet.
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
          <CardHeader>
            <CardTitle className="font-tenant-display">Pipeline status</CardTitle>
            <p className="text-xs text-muted-foreground">Click a bar to open those leads</p>
          </CardHeader>
          <CardContent>
            <PipelineBar data={pipelineData} accent={theme.tokens.accent} navy={theme.tokens.navy} />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
        <CardHeader>
          <CardTitle className="font-tenant-display">Lead volume (last {VOLUME_DAYS} days)</CardTitle>
          <p className="text-xs text-muted-foreground">Click a day to open that day’s leads</p>
        </CardHeader>
        <CardContent>
          <VolumeLine data={volumeData} navy={theme.tokens.navy} />
        </CardContent>
      </Card>

      {/* Recent leads */}
      <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
        <CardHeader>
          <CardTitle className="font-tenant-display">Recent leads</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {recent.length === 0 && (
            <p className="text-sm text-muted-foreground">No leads yet.</p>
          )}
          {recent.map((l) => (
            <Link
              key={l.id}
              href={`/leads/${l.id}`}
              className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-tenant-gray"
            >
              <span className="font-medium">{l.full_name || '(no name)'}</span>
              <span className="flex items-center gap-2">
                <Badge variant="outline">
                  {SOURCE_LABELS[l.utm_source as LeadSource] ?? l.utm_source}
                </Badge>
                <Badge variant={STATUS_BADGE[l.status as LeadStatus]}>
                  {STATUS_LABELS[l.status as LeadStatus]}
                </Badge>
              </span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
