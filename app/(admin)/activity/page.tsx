import { Activity, FileSpreadsheet } from 'lucide-react';
import { requireActivityAccess } from '@/lib/activity/guard';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DownloadReportButton } from '@/components/dashboard/download-report-button';
import type { ActivityEntry } from '@/lib/activity/types';

export const metadata = { title: 'Activity Tracker' };

function isThisWeek(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - now.getDay());
  start.setHours(0, 0, 0, 0);
  return d >= start;
}

function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-tenant-accent">
          {label}
        </p>
        <p className="mt-2 font-tenant-display text-3xl font-semibold text-tenant-ink">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export default async function ActivityPage() {
  const profile = await requireActivityAccess();
  const supabase = await createClient();

  const { data: rawEntries } = await supabase
    .from('activity_entries')
    .select('id, category, title, description, activity_date, created_at')
    .eq('organization_id', profile.organization_id)
    .order('activity_date', { ascending: false })
    .order('created_at', { ascending: false });

  const entries: ActivityEntry[] = rawEntries ?? [];
  const thisWeek = entries.filter((e) => isThisWeek(e.activity_date)).length;
  const thisMonth = entries.filter((e) => isThisMonth(e.activity_date)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Activity}
        title="Activity Tracker"
        subtitle="A running report of the work Aetarix has done for you — read-only."
        action={
          <div className="flex flex-wrap gap-2">
            <DownloadReportButton href="/api/activity/report" label="Download PDF" />
            <a
              href="/api/activity/export"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-tenant-ink/10 bg-white px-3 text-sm text-tenant-ink transition-colors hover:bg-tenant-gray"
            >
              <FileSpreadsheet className="h-4 w-4" /> Export to Excel
            </a>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="This week" value={String(thisWeek)} />
        <MetricCard label="This month" value={String(thisMonth)} />
        <MetricCard label="Total logged" value={String(entries.length)} />
      </div>

      <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(e.activity_date).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge variant="neutral">{e.category}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{e.title}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.description ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
              {entries.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No activity logged yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
