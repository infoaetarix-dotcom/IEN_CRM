import { Banknote } from 'lucide-react';
import { requireStudentFinanceAccess } from '@/lib/finance/student-guard';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { AddStudentEntryDialog } from '@/components/dashboard/student-finance/add-entry-dialog';
import { StudentEntriesTable } from '@/components/dashboard/student-finance/entries-table';
import { formatAmount, extractLeadName, type StudentFinanceEntry } from '@/lib/finance/types';

export const metadata = { title: 'Student Finance' };

function MetricCard({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'income' | 'expense' | 'neutral';
}) {
  return (
    <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
      <CardContent className="p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-tenant-accent">
          {label}
        </p>
        <p
          className={
            tone === 'income'
              ? 'mt-2 font-tenant-display text-3xl font-semibold text-emerald-700'
              : tone === 'expense'
                ? 'mt-2 font-tenant-display text-3xl font-semibold text-red-700'
                : 'mt-2 font-tenant-display text-3xl font-semibold text-tenant-ink'
          }
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

export default async function StudentFinancePage() {
  const profile = await requireStudentFinanceAccess();
  const supabase = await createClient();

  // Independent reads — the org-wide entries list and the lead picker's
  // options don't depend on each other, so they're fired together.
  const [{ data: rawEntries }, { data: leads }] = await Promise.all([
    supabase
      .from('student_finance_entries')
      .select(
        'id, type, amount, category, payment_method, note, entry_date, lead_id, created_by, created_at, leads(full_name), profiles(full_name)',
      )
      .eq('organization_id', profile.organization_id)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('leads').select('id, full_name').order('full_name'),
  ]);

  const entries: StudentFinanceEntry[] = (rawEntries ?? []).map((e) => ({
    id: e.id,
    type: e.type,
    amount: Number(e.amount),
    category: e.category,
    payment_method: e.payment_method,
    note: e.note,
    lead_id: e.lead_id,
    lead_name: extractLeadName(e.leads),
    entry_date: e.entry_date,
    created_at: e.created_at,
    created_by: e.created_by,
    created_by_name: extractLeadName(e.profiles),
  }));

  const totalIncome = entries
    .filter((e) => e.type === 'income')
    .reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = entries
    .filter((e) => e.type === 'expense')
    .reduce((sum, e) => sum + e.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Banknote}
        title="Student Finance"
        subtitle="Shared with your whole team — every payment tied to a student, visible to every admin and agent."
        action={<AddStudentEntryDialog leads={leads ?? []} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total income" value={formatAmount(totalIncome)} tone="income" />
        <MetricCard label="Total expense" value={formatAmount(totalExpense)} tone="expense" />
        <MetricCard
          label="Net balance"
          value={formatAmount(balance)}
          tone={balance >= 0 ? 'income' : 'expense'}
        />
        <MetricCard label="Total entries" value={String(entries.length)} />
      </div>

      <Card className="rounded-xl border-tenant-ink/10 shadow-sm">
        <CardContent className="p-0">
          <StudentEntriesTable entries={entries} leads={leads ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
