import ExcelJS from 'exceljs';
import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { getReportingSettings } from '@/lib/reports/settings';
import { zonedDateKey } from '@/lib/reports/time';
import { APPLICATION_STATUS_LABELS, type ApplicationStatus } from '@/lib/leads/display';
import { CODE_LABELS } from '@/lib/form-options';
import {
  parseApplicationListFilters,
  matchesApplicationListFilters,
  applicationSearchText,
} from '@/lib/applications/list-filters';
import { isFollowUpFilter, matchesFollowUpFilter } from '@/lib/follow-ups/status';
import { getOpenFollowUps } from '@/lib/follow-ups/load';

export const dynamic = 'force-dynamic';

// Sane upper bound so a single export can't run an unbounded query.
const EXPORT_ROW_LIMIT = 10000;

const COLUMNS = [
  { header: 'Application #', key: 'application_number', width: 14 },
  { header: 'Lead #', key: 'lead_number', width: 10 },
  { header: 'Full Name', key: 'full_name', width: 24 },
  { header: 'Email', key: 'email', width: 28 },
  { header: 'Phone', key: 'phone', width: 16 },
  { header: 'Passport Number', key: 'passport_number', width: 18 },
  { header: 'Status', key: 'status', width: 26 },
  { header: 'University', key: 'university', width: 28 },
  { header: 'University Country', key: 'university_country', width: 18 },
  { header: 'Target Country', key: 'target_country', width: 16 },
  { header: 'Program', key: 'program', width: 24 },
  { header: 'Intake', key: 'intake_season', width: 12 },
  { header: 'Intake Year', key: 'intake_year', width: 12 },
  { header: 'Date of Birth', key: 'date_of_birth', width: 14 },
  { header: 'Marital Status', key: 'marital_status', width: 16 },
  { header: 'City', key: 'city', width: 16 },
  { header: 'District', key: 'district', width: 16 },
  { header: 'Highest Education', key: 'highest_education', width: 20 },
  { header: 'Last Qualification', key: 'last_qualification', width: 22 },
  { header: 'Prior Institution', key: 'prior_institution', width: 22 },
  { header: 'Passing Year', key: 'passing_year', width: 12 },
  { header: 'Grading System', key: 'grading_system', width: 16 },
  { header: 'Result', key: 'result', width: 14 },
  { header: 'Work Experience (yrs)', key: 'work_experience_years', width: 20 },
  { header: 'English Test', key: 'english_test', width: 14 },
  { header: 'English Score', key: 'english_score', width: 14 },
  { header: 'Funding Source', key: 'funding_source', width: 16 },
  { header: 'Budget (PKR)', key: 'budget_range', width: 16 },
  { header: 'Prior Visa Rejection', key: 'prior_rejection', width: 18 },
  { header: 'Rejection Detail', key: 'prior_rejection_detail', width: 28 },
  { header: 'Created By', key: 'created_by', width: 20 },
  { header: 'Created At', key: 'created_at', width: 20 },
];

const label = (code: string | null | undefined) => (code ? (CODE_LABELS[code] ?? code) : '');

/**
 * Excel / CSV of applications — whatever the Export dialog on /applications
 * asks for: a created-date range (whole days in the org's time zone) and,
 * optionally, the list's current filters (same matcher as the page, so the
 * file and the list agree). RLS scopes rows to the caller's org.
 */
export async function GET(request: NextRequest) {
  const profile = await requireUser();
  const supabase = await createClient();
  const { timezone } = await getReportingSettings(profile.organization_id!);
  const sp = Object.fromEntries(request.nextUrl.searchParams.entries());
  const filters = parseApplicationListFilters(sp);

  const [{ data: apps, error }, { data: profiles }, followUps] = await Promise.all([
    supabase
      .from('applications')
      .select(
        `id, application_number, status, full_name, email, phone, passport_number, target_country, program,
         intake_season, intake_year, date_of_birth, marital_status, city, district, highest_education,
         last_qualification, prior_institution, passing_year, grading_system, grade_value, grade_letter,
         work_experience_years, english_test, english_score, funding_source, budget_range, prior_rejection,
         prior_rejection_detail, created_by, created_at, leads(lead_number, full_name), universities(name, country)`,
      )
      .order('created_at', { ascending: false })
      .limit(EXPORT_ROW_LIMIT),
    supabase.from('profiles').select('id, full_name'),
    isFollowUpFilter(sp.followup ?? '') ? getOpenFollowUps('application') : Promise.resolve(null),
  ]);
  if (error) return new Response('Could not export applications.', { status: 500 });

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const todayKey = zonedDateKey(new Date(), timezone);
  const followupFilter = sp.followup ?? '';

  const rows = (apps ?? []).filter((a) => {
    const uni = Array.isArray(a.universities) ? a.universities[0] : a.universities;
    const lead = Array.isArray(a.leads) ? a.leads[0] : a.leads;
    if (followUps && isFollowUpFilter(followupFilter)) {
      const f = followUps.get(a.id);
      if (!f || !matchesFollowUpFilter(f.due_date, followupFilter, todayKey)) return false;
    }
    return matchesApplicationListFilters(
      {
        status: a.status,
        intake_season: a.intake_season,
        intake_year: a.intake_year,
        university_name: uni?.name ?? null,
        country: uni?.country ?? null,
        created_by: a.created_by,
        created_date: zonedDateKey(new Date(a.created_at), timezone),
        search_text: applicationSearchText([
          a.full_name,
          lead?.full_name,
          a.email,
          a.phone,
          a.passport_number,
          a.application_number,
          lead?.lead_number,
        ]),
      },
      filters,
    );
  });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Applications');
  sheet.columns = COLUMNS;
  sheet.getRow(1).font = { bold: true };
  for (const a of rows) {
    const uni = Array.isArray(a.universities) ? a.universities[0] : a.universities;
    const lead = Array.isArray(a.leads) ? a.leads[0] : a.leads;
    sheet.addRow({
      ...a,
      full_name: a.full_name || lead?.full_name || '',
      lead_number: lead?.lead_number ?? '',
      status: APPLICATION_STATUS_LABELS[a.status as ApplicationStatus] ?? a.status,
      university: uni?.name ?? '',
      university_country: uni?.country ?? '',
      intake_season: label(a.intake_season),
      marital_status: label(a.marital_status),
      grading_system: label(a.grading_system),
      result: a.grade_letter || (a.grade_value ?? ''),
      english_test: label(a.english_test),
      funding_source: label(a.funding_source),
      budget_range: label(a.budget_range),
      prior_rejection: a.prior_rejection ? 'Yes' : 'No',
      created_by: a.created_by ? (nameById.get(a.created_by) ?? '') : '',
      created_at: new Date(a.created_at).toLocaleString('en-GB', { timeZone: timezone }),
    });
  }

  const stem =
    filters.from || filters.to
      ? `applications-${filters.from || 'start'}-to-${filters.to || todayKey}`
      : `applications-export-${todayKey}`;

  if (sp.format === 'csv') {
    // BOM so Excel opens UTF-8 names (e.g. Urdu) correctly.
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
