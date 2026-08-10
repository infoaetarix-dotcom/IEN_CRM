import ExcelJS from 'exceljs';
import { requireActivityAccess } from '@/lib/activity/guard';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const COLUMNS = [
  { header: 'Date', key: 'activity_date', width: 14 },
  { header: 'Category', key: 'category', width: 20 },
  { header: 'Title', key: 'title', width: 32 },
  { header: 'Description', key: 'description', width: 50 },
];

export async function GET() {
  const profile = await requireActivityAccess();
  const supabase = await createClient();

  const { data: entries, error } = await supabase
    .from('activity_entries')
    .select('activity_date, category, title, description')
    .eq('organization_id', profile.organization_id)
    .order('activity_date', { ascending: false });
  if (error) return new Response('Could not export activity.', { status: 500 });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Activity');
  sheet.columns = COLUMNS;
  sheet.getRow(1).font = { bold: true };

  for (const e of entries ?? []) {
    sheet.addRow({
      activity_date: new Date(e.activity_date).toLocaleDateString('en-GB'),
      category: e.category,
      title: e.title,
      description: e.description ?? '',
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `activity-export-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new Response(buffer, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
