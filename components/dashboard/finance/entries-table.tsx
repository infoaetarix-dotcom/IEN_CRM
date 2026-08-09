'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { deleteFinanceEntry } from '@/app/(admin)/finance/actions';
import { formatAmount, type FinanceEntry } from '@/lib/finance/types';
import { AddEntryDialog } from './add-entry-dialog';

export function EntriesTable({
  entries,
  leads,
}: {
  entries: FinanceEntry[];
  leads: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function handleDelete(id: string) {
    if (!confirm('Delete this entry? This cannot be undone.')) return;
    setDeletingId(id);
    start(async () => {
      await deleteFinanceEntry(id);
      router.refresh();
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Payment</TableHead>
          <TableHead>Lead</TableHead>
          <TableHead>Note</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((e) => (
          <TableRow key={e.id}>
            <TableCell className="whitespace-nowrap">
              {new Date(e.entry_date).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}
            </TableCell>
            <TableCell>
              <Badge variant={e.type === 'income' ? 'success' : 'danger'}>
                {e.type === 'income' ? 'Income' : 'Expense'}
              </Badge>
            </TableCell>
            <TableCell
              className={`whitespace-nowrap font-medium ${e.type === 'income' ? 'text-emerald-700' : 'text-red-700'}`}
            >
              {e.type === 'income' ? '+' : '−'} {formatAmount(e.amount)}
            </TableCell>
            <TableCell>{e.category}</TableCell>
            <TableCell className="text-muted-foreground">{e.payment_method ?? '—'}</TableCell>
            <TableCell className="text-muted-foreground">{e.lead_name ?? '—'}</TableCell>
            <TableCell className="max-w-[220px] truncate text-muted-foreground">
              {e.note ?? '—'}
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <AddEntryDialog
                  leads={leads}
                  entry={e}
                  trigger={
                    <button
                      type="button"
                      title="Edit"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-tenant-gray hover:text-tenant-ink"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  }
                />
                <button
                  type="button"
                  title="Delete"
                  disabled={pending && deletingId === e.id}
                  onClick={() => handleDelete(e.id)}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </TableCell>
          </TableRow>
        ))}
        {entries.length === 0 && (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-muted-foreground">
              No entries yet — add your first one above.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
