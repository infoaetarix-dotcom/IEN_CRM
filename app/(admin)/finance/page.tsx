import { Wallet } from 'lucide-react';
import { requireFinanceAccess } from '@/lib/finance/guard';
import { createClient } from '@/lib/supabase/server';
import { PageHeader } from '@/components/dashboard/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { AddEntryDialog } from '@/components/dashboard/finance/add-entry-dialog';
import { EntriesTable } from '@/components/dashboard/finance/entries-table';
import { DownloadStatementButton } from '@/components/dashboard/finance/download-statement-button';
import { formatAmount, extractLeadName, type FinanceEntry } from '@/lib/finance/types';

export const metadata = { title: 'Finance' };

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

export default async function FinancePage() {
  const profile = await requireFinanceAccess();
  const supabase = await createClient();

  const [{ data: rawEntries }, { data: leads }] = await Promise.all([
    supabase
      .from('finance_entries')
      .select(
        'id, type, amount, category, payment_method, note, entry_date, lead_id, created_at, leads(full_name)',
      )
      .eq('user_id', profile.id)
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('leads').select('id, full_name').order('full_name'),
  ]);

  const entries: FinanceEntry[] = (rawEntries ?? []).map((e) => ({
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
        icon={Wallet}
        title="Finance"
        subtitle="Your own private income and expense ledger — no one else on your team sees this."
        action={
          <div className="flex flex-wrap gap-2">
            <DownloadStatementButton />
            <AddEntryDialog leads={leads ?? []} />
          </div>
        }
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
          <EntriesTable entries={entries} leads={leads ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
