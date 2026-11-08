import ExcelJS from 'exceljs';
import type { NextRequest } from 'next/server';
import { requireAttendanceAdmin } from '@/lib/attendance/server';
import { loadAttendanceReport, formatTime } from '@/lib/attendance/report';
import { formatDuration, sessionSeconds } from '@/lib/attendance/records';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const COLUMNS = [
  { header: 'Date', key: 'date', width: 12 },
  { header: 'Day', key: 'day', width: 8 },
  { header: 'Agent', key: 'agent', width: 24 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Clock In', key: 'clock_in', width: 11 },
  { header: 'Clock In From', key: 'in_place', width: 14 },
  { header: 'Clock Out', key: 'clock_out', width: 11 },
  { header: 'Clock Out From', key: 'out_place', width: 15 },
  { header: 'Clocked Out By', key: 'method', width: 15 },
  { header: 'Session Hours', key: 'session', width: 14 },
  { header: 'Day Total', key: 'total', width: 11 },
];

const STATUS = { working: 'Clocked in', present: 'Present', absent: 'Absent', not_in_yet: 'Not in yet' } as const;
const PLACE = { office: 'Office', remote: 'Remote' } as const;

/**
 * Excel / CSV of attendance for the Export dialog on /attendance: one row
 * per session, plus one "Absent" row per weekday an agent didn't clock in.
 * No "from" means from the first record. Admins only, RLS-scoped.
 */
export async function GET(request: NextRequest) {
  const profile = await requireAttendanceAdmin();
  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());

  if (!sp.from) {
    const { data: first } = await (await createClient())
      .from('attendance_sessions')
      .select('work_date')
      .eq('organization_id', profile.organization_id)
      .order('work_date', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (first) sp.from = first.work_date;
  }

  const { timezone, todayKey, filters, history } = await loadAttendanceReport(profile.organization_id, sp);
  const now = new Date();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Attendance');
  sheet.columns = COLUMNS;
  sheet.getRow(1).font = { bold: true };

  // Oldest first reads more naturally in a spreadsheet.
  for (const r of [...history].reverse()) {
    const base = {
      date: r.date,
      day: new Date(`${r.date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }),
      agent: r.agentName,
      status: r.status === 'present' && r.weekend ? 'Weekend work' : STATUS[r.status],
      total: r.sessions.length ? formatDuration(r.totalSeconds) : '',
    };
    if (!r.sessions.length) {
      sheet.addRow(base);
      continue;
    }
    for (const s of r.sessions) {
      sheet.addRow({
        ...base,
        clock_in: formatTime(s.clock_in_at, timezone),
        in_place: PLACE[s.clock_in_place],
        clock_out: s.clock_out_at ? formatTime(s.clock_out_at, timezone) : 'Still working',
        out_place: s.clock_out_place ? PLACE[s.clock_out_place] : '',
        method: s.clock_out_method === 'auto' ? 'Auto (CRM closed)' : s.clock_out_method === 'manual' ? 'Agent' : '',
        session: formatDuration(sessionSeconds(s, now)),
      });
    }
  }

  const stem = `attendance-${filters.from}-to-${filters.to || todayKey}`;
  if (sp.format === 'csv') {
    // BOM so Excel opens UTF-8 names correctly.
    const csv = await workbook.csv.writeBuffer();
    return new Response(new Blob(['﻿', csv]), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${stem}.csv"`,
      },
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${stem}.xlsx"`,
    },
  });
}
