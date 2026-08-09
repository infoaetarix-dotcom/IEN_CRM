import ExcelJS from 'exceljs';
import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/guards';
import { createClient } from '@/lib/supabase/server';
import { applyLeadFilters } from '@/lib/leads/filters';
import {
  STATUS_LABELS,
  SOURCE_LABELS,
  type LeadStatus,
  type LeadSource,
} from '@/lib/leads/display';
import { CODE_LABELS } from '@/lib/form-options';

export const dynamic = 'force-dynamic';

// Sane upper bound so a single export can't run an unbounded query.
const EXPORT_ROW_LIMIT = 10000;

const COLUMNS = [
  { header: 'Lead #', key: 'lead_number', width: 10 },
  { header: 'Full Name', key: 'full_name', width: 24 },
  { header: 'Email', key: 'email', width: 28 },
  { header: 'Phone', key: 'phone', width: 16 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Source', key: 'utm_source', width: 12 },
  { header: 'City', key: 'city', width: 16 },
  { header: 'District', key: 'district', width: 16 },
  { header: 'Target Country', key: 'target_country', width: 16 },
  { header: 'Institution', key: 'institution', width: 22 },
  { header: 'Program', key: 'program', width: 22 },
  { header: 'Highest Education', key: 'highest_education', width: 20 },
  { header: 'Last Qualification', key: 'last_qualification', width: 20 },
  { header: 'Prior Institution', key: 'prior_institution', width: 22 },
  { header: 'Passing Year', key: 'passing_year', width: 12 },
  { header: 'Grading System', key: 'grading_system', width: 16 },
  { header: 'Grade Value', key: 'grade_value', width: 12 },
  { header: 'Work Experience (yrs)', key: 'work_experience_years', width: 20 },
  { header: 'English Test', key: 'english_test', width: 14 },
  { header: 'English Score', key: 'english_score', width: 14 },
  { header: 'Intake Season', key: 'intake_season', width: 14 },
  { header: 'Intake Year', key: 'intake_year', width: 12 },
  { header: 'Funding Source', key: 'funding_source', width: 16 },
  { header: 'Created By', key: 'created_by', width: 20 },
  { header: 'Consent Given', key: 'consent_given', width: 14 },
  { header: 'Created At', key: 'created_at', width: 20 },
  { header: 'Archived', key: 'archived_at', width: 12 },
];

/**
 * Streams the current leads list (whatever filters are active in the query
 * string, unpaginated) as a real .xlsx file. RLS on the user-session client
 * scopes rows to the caller's org exactly like the leads page itself —
 * nothing here bypasses that.
 */
export async function GET(request: NextRequest) {
  await requireUser();
  const supabase = await createClient();
  const sp = request.nextUrl.searchParams;
  const str = (k: string) => sp.get(k) ?? '';

  let query = supabase.from('leads').select(
    `id, lead_number, full_name, email, phone, status, utm_source, city, district,
     target_country, institution, program, highest_education, last_qualification,
     prior_institution, passing_year, grading_system, grade_value,
     work_experience_years, english_test, english_score, intake_season, intake_year,
     funding_source, created_by, consent_given, created_at, archived_at`,
  );

  query = applyLeadFilters(query, {
    q: str('q'),
    status: str('status'),
    source: str('source'),
    completeness: str('completeness'),
    from: str('from'),
    to: str('to'),
    archived: str('archived') === '1',
  });

  const { data: leads, error } = await query
    .order('created_at', { ascending: false })
    .limit(EXPORT_ROW_LIMIT);
  if (error) return new Response('Could not export leads.', { status: 500 });

  const { data: profiles } = await supabase.from('profiles').select('id, full_name');
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Leads');
  sheet.columns = COLUMNS;
  sheet.getRow(1).font = { bold: true };

  for (const l of leads ?? []) {
    sheet.addRow({
      ...l,
      status: STATUS_LABELS[l.status as LeadStatus] ?? l.status,
      utm_source: SOURCE_LABELS[l.utm_source as LeadSource] ?? l.utm_source,
      grading_system: l.grading_system
        ? (CODE_LABELS[l.grading_system] ?? l.grading_system)
        : '',
      english_test: l.english_test
        ? (CODE_LABELS[l.english_test] ?? l.english_test)
        : '',
      intake_season: l.intake_season
        ? (CODE_LABELS[l.intake_season] ?? l.intake_season)
        : '',
      funding_source: l.funding_source
        ? (CODE_LABELS[l.funding_source] ?? l.funding_source)
        : '',
      created_by: l.created_by ? (nameById.get(l.created_by) ?? '') : '',
      consent_given: l.consent_given ? 'Yes' : 'No',
      created_at: new Date(l.created_at).toLocaleString('en-GB'),
      archived_at: l.archived_at ? 'Archived' : '',
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `leads-export-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
