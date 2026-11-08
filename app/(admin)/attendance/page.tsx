import { Clock } from 'lucide-react';
import { requireAttendanceAdmin } from '@/lib/attendance/server';
import { loadAttendanceReport, formatDate, formatTime } from '@/lib/attendance/report';
import { formatDuration, type AttendanceSession, type DayRecord } from '@/lib/attendance/records';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ExportDialog } from '@/components/dashboard/export-dialog';
import { AttendanceFilters } from '@/components/dashboard/attendance/attendance-filters';

export const metadata = { title: 'Attendance' };

function PlaceTag({ place }: { place: 'office' | 'remote' | null }) {
  if (!place) return null;
  return (
    <Badge variant={place === 'office' ? 'success' : 'info'} className="ml-1.5">
      {place === 'office' ? 'Office' : 'Remote'}
    </Badge>
  );
}

function StatusBadge({ record }: { record: DayRecord }) {
  switch (record.status) {
    case 'working':
      return <Badge variant="success">Clocked in</Badge>;
    case 'present':
      return <Badge variant="neutral">{record.weekend ? 'Weekend work' : 'Present'}</Badge>;
    case 'not_in_yet':
      return <Badge variant="warning">Not in yet</Badge>;
    case 'absent':
      return <Badge variant="danger">Absent</Badge>;
  }
}

function SessionLines({ sessions, timezone }: { sessions: AttendanceSession[]; timezone: string }) {
  if (!sessions.length) return <span className="text-muted-foreground">—</span>;
  return (
    <ul className="space-y-1.5">
      {sessions.map((s) => (
        <li key={s.id} className="flex flex-wrap items-center gap-x-1 gap-y-1">
          <span className="whitespace-nowrap">
            In {formatTime(s.clock_in_at, timezone)}
            <PlaceTag place={s.clock_in_place} />
          </span>
          <span className="px-1 text-muted-foreground">→</span>
          {s.clock_out_at ? (
            <span className="whitespace-nowrap">
              Out {formatTime(s.clock_out_at, timezone)}
              <PlaceTag place={s.clock_out_place} />
              {s.clock_out_method === 'auto' && (
                <Badge variant="warning" className="ml-1.5" title="The CRM was closed without clocking out">
                  Auto
                </Badge>
              )}
            </span>
          ) : (
            <span className="text-emerald-700">still working</span>
          )}
        </li>
      ))}
    </ul>
  );
}

/**
 * Attendance (admins, module on): who's in today, then every agent's
 * clock-ins and clock-outs for a date range, with Excel export. Agents
 * clock in from the top bar and don't see this page.
 */
export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireAttendanceAdmin();
  const report = await loadAttendanceReport(profile.organization_id, await searchParams);
  const { timezone, today, history, filters } = report;
  const inNow = today.filter((r) => r.status === 'working').length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Clock}
        title="Attendance"
        subtitle="When each agent clocked in and out, and whether from the office network or remotely."
        action={
          <ExportDialog
            endpoint="/api/attendance/export"
            noun="attendance"
            dateVerb="recorded"
            filterKeys={['agent']}
            todayKey={report.todayKey}
          />
        }
      />

      <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="font-tenant-display text-tenant-ink">Today</CardTitle>
          <span className="text-sm text-muted-foreground">
            {inNow} of {today.length} clocked in now
          </span>
        </CardHeader>
        <CardContent>
          {today.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active agents yet.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" aria-label="Today">
              {today.map((r) => (
                <li
                  key={r.agentId}
                  className="flex items-start justify-between gap-3 rounded-lg border border-tenant-ink/10 bg-white p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-tenant-ink">{r.agentName}</p>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <SessionLines sessions={r.sessions} timezone={timezone} />
                    </div>
                  </div>
                  <div className="flex flex-none flex-col items-end gap-1">
                    <StatusBadge record={r} />
                    {r.totalSeconds > 0 && (
                      <span className="text-xs text-muted-foreground">{formatDuration(r.totalSeconds)}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
        <CardHeader className="space-y-4">
          <CardTitle className="font-tenant-display text-tenant-ink">History</CardTitle>
          <AttendanceFilters
            agents={report.agents.map((a) => ({ id: a.id, name: a.name }))}
            from={filters.from}
            to={filters.to}
            agent={filters.agent}
          />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Clock in / Clock out</TableHead>
                <TableHead className="text-right">Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((r) => (
                <TableRow key={`${r.date}|${r.agentId}`}>
                  <TableCell className="whitespace-nowrap">{formatDate(r.date)}</TableCell>
                  <TableCell className="whitespace-nowrap font-medium">{r.agentName}</TableCell>
                  <TableCell>
                    <StatusBadge record={r} />
                  </TableCell>
                  <TableCell className="min-w-[300px] text-sm">
                    <SessionLines sessions={r.sessions} timezone={timezone} />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {r.sessions.length ? formatDuration(r.totalSeconds) : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {history.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Nothing recorded for these dates. Saturdays and Sundays are off days.
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
