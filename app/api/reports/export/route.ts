import ExcelJS from 'exceljs';
import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/guards';
import { getReportingSettings } from '@/lib/reports/settings';
import {
  loadLeadReport,
  countLeads,
  loadIntakeReport,
  loadIntakeLeadReport,
  countIntakeLeads,
  loadIntakeOptions,
} from '@/lib/reports/load';
import { resolveReportSelection } from '@/lib/reports/selection';
import { APPLICATION_STAGE_LABELS, type ApplicationStage } from '@/lib/leads/display';
import type { LeadReport } from '@/lib/reports/leads';
import type { IntakeReport } from '@/lib/reports/applications';

/**
 * Excel download of whatever Settings → Reports is showing. Same URL
 * parameters, same loaders, so the file always matches the screen. An
 * intake report has both halves: "Leads –" and "Apps –" sheets.
 */
export async function GET(request: NextRequest) {
  const profile = await requireUser();
  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());

  const [settings, intakeInfo] = await Promise.all([
    getReportingSettings(profile.organization_id!),
    loadIntakeOptions(),
  ]);
  const tz = settings.timezone;
  const selection = resolveReportSelection(sp, { tz, now: new Date(), intakes: intakeInfo.options });

  const workbook = new ExcelJS.Workbook();

  if (selection.type === 'intake') {
    const [leads, leadsPrevious, apps, appsPrevious] = await Promise.all([
      loadIntakeLeadReport(selection.season, selection.year, tz),
      countIntakeLeads(selection.season, selection.year - 1),
      loadIntakeReport(selection.season, selection.year),
      loadIntakeReport(selection.season, selection.year - 1),
    ]);
    addLeadSheets(workbook, 'Leads – ', selection.title, 'Leads for this intake', selection.previousLabel, leadsPrevious, leads);
    addIntakeSheets(workbook, 'Apps – ', selection.title, selection.previousLabel, apps, appsPrevious);
  } else {
    const [report, previousCount] = await Promise.all([
      loadLeadReport(selection.range, tz),
      countLeads(selection.previous),
    ]);
    addLeadSheets(workbook, '', selection.title, 'Leads received', selection.previousLabel, previousCount, report);
    sheetWithRows(workbook, 'By day', ['Date', 'Leads'], report.daily.map((d) => [d.key, d.count]));
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `report-${selection.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.xlsx`;
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function sheetWithRows(workbook: ExcelJS.Workbook, name: string, header: string[], rows: (string | number)[][]) {
  const sheet = workbook.addWorksheet(name);
  sheet.addRow(header).font = { bold: true };
  for (const r of rows) sheet.addRow(r);
  sheet.columns.forEach((c, i) => {
    c.width = i === 0 ? 34 : 18;
  });
  return sheet;
}

function addLeadSheets(
  workbook: ExcelJS.Workbook,
  prefix: string,
  title: string,
  totalLabel: string,
  previousLabel: string,
  previousCount: number,
  r: LeadReport,
) {
  const rejected = r.byStatus.find((s) => s.key === 'rejected')?.count ?? 0;
  sheetWithRows(workbook, `${prefix}Summary`, [title, ''], [
    [totalLabel, r.total],
    [`${totalLabel} — ${previousLabel}`, previousCount],
    ['Became applications', r.converted],
    ['Contacted within 1 hour (%)', r.responseRate],
    ['Rejected', rejected],
  ]);
  sheetWithRows(workbook, `${prefix}By source`, ['Source', 'Leads'], r.bySource.map((s) => [s.label, s.count]));
  sheetWithRows(workbook, `${prefix}By status`, ['Status', 'Leads'], r.byStatus.map((s) => [s.label, s.count]));
  sheetWithRows(
    workbook,
    `${prefix}By staff`,
    ['Staff', 'Leads', 'Contacted < 1h', 'Became applications'],
    r.byStaff.map((s) => [s.label, s.count, s.fastResponses, s.converted]),
  );
}

function addIntakeSheets(
  workbook: ExcelJS.Workbook,
  prefix: string,
  title: string,
  previousLabel: string,
  r: IntakeReport,
  previous: IntakeReport,
) {
  sheetWithRows(
    workbook,
    `${prefix}Summary`,
    [title, 'Count', previousLabel],
    [
      ...r.milestones.map((m) => [m.label, m.count, previous.milestones.find((p) => p.key === m.key)?.count ?? 0]),
      ['Visa success rate (%)', r.visaSuccessRate ?? '—', previous.visaSuccessRate ?? '—'],
    ],
  );
  sheetWithRows(
    workbook,
    `${prefix}By status`,
    ['Status', 'Stage', 'Applications'],
    r.byStatus.map((s) => [s.label, APPLICATION_STAGE_LABELS[s.stage as ApplicationStage] ?? s.stage, s.count]),
  );
  const cols = ['Applications', 'Visa applied', 'Visa accepted', 'Visa rejected'];
  sheetWithRows(
    workbook,
    `${prefix}By university`,
    ['University', ...cols],
    r.byUniversity.map((b) => [b.label, b.total, b.visaApplied, b.visaAccepted, b.visaRejected]),
  );
  sheetWithRows(
    workbook,
    `${prefix}By country`,
    ['Country', ...cols],
    r.byCountry.map((b) => [b.label, b.total, b.visaApplied, b.visaAccepted, b.visaRejected]),
  );
}
