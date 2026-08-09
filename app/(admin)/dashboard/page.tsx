import Link from 'next/link';
import { LayoutDashboard } from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getOrgBrand } from '@/lib/branding/org';
import { resolveTheme } from '@/lib/branding/themes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/dashboard/page-header';
import { SourceBar, PipelineBar, VolumeLine } from '@/components/charts/dashboard-charts';
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

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-tenant-accent">
          {label}
        </p>
        <p className="mt-2 font-tenant-display text-3xl font-semibold text-tenant-ink">
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const profile = await requireUser();
  const supabase = await createClient();
  const brand = await getOrgBrand(profile.organization_id);
  const theme = resolveTheme(brand.themeKey);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // RLS scopes these to the caller's organization (shared across admin + agents).
  const { data: leads } = await supabase
    .from('leads')
    .select('id, full_name, status, utm_source, created_at')
    .is('archived_at', null)
    .order('created_at', { ascending: false });

  const all = leads ?? [];

  // First 'contacted' status change per lead, for response-rate.
  const { data: contactedHistory } = await supabase
    .from('lead_status_history')
    .select('lead_id, changed_at')
    .eq('to_status', 'contacted')
    .order('changed_at', { ascending: true });
  const firstContact = new Map<string, string>();
  for (const h of contactedHistory ?? []) {
    if (!firstContact.has(h.lead_id)) firstContact.set(h.lead_id, h.changed_at);
  }

  const totalThisMonth = all.filter(
    (l) => new Date(l.created_at) >= startOfMonth,
  ).length;
  const newToday = all.filter(
    (l) => l.status === 'new' && new Date(l.created_at) >= startOfToday,
  ).length;
  const sourceData = buildSourceData(all);
  const pipelineData = buildPipelineData(all);
  const volumeData = buildVolumeData(all, 14, now);
  const recentLeadsIn30 = all.filter((l) => new Date(l.created_at) >= last30);
  const response = computeResponseRate(recentLeadsIn30, firstContact);
  const recent = all.slice(0, 6);

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
          hint={now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
        />
        <MetricCard label="New today (unworked)" value={newToday} />
        <MetricCard
          label="Response rate < 1h"
          value={response.rate == null ? '—' : `${response.rate}%`}
          hint={
            response.rate == null
              ? 'No leads in last 30 days'
              : `${response.within} of ${response.denom} (last 30 days)`
          }
        />
        <MetricCard label="Active sources" value={sourceData.length} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
          <CardHeader>
            <CardTitle className="font-tenant-display">Leads by source</CardTitle>
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
          </CardHeader>
          <CardContent>
            <PipelineBar data={pipelineData} accent={theme.tokens.accent} navy={theme.tokens.navy} />
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
        <CardHeader>
          <CardTitle className="font-tenant-display">Lead volume (last 14 days)</CardTitle>
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
