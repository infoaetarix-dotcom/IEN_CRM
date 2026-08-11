'use client';

import { useActionState, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { LeadPicker } from '@/components/dashboard/lead-picker';
import {
  createFinanceEntry,
  updateFinanceEntry,
  type FinanceActionState,
} from '@/app/(admin)/finance/actions';
import { FINANCE_CATEGORIES, FINANCE_PAYMENT_METHODS, type FinanceEntry } from '@/lib/finance/types';

const init: FinanceActionState = { ok: false };

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** "+ Add entry" by default, or an edit dialog when passed an existing entry + custom trigger. */
export function AddEntryDialog({
  leads,
  entry,
  trigger,
}: {
  leads: { id: string; full_name: string }[];
  entry?: FinanceEntry;
  trigger?: ReactNode;
}) {
  const router = useRouter();
  const isEdit = !!entry;
  const action = isEdit ? updateFinanceEntry.bind(null, entry.id) : createFinanceEntry;
  const [state, formAction, pending] = useActionState(action, init);
  const [open, setOpen] = useState(false);
  const [leadId, setLeadId] = useState(entry?.lead_id ?? '');

  // Depend on the whole state object, not state.ok: a second consecutive
  // successful "Add entry" also resolves to { ok: true }, which is === the
  // previous value, so an effect keyed on just .ok would silently skip
  // firing (the dialog would stay open on every submission after the first).
  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // This one persistent "Add entry" dialog is reused for every new
        // entry — reset the lead picker on each fresh open so a lead picked
        // for a previous entry doesn't silently carry over to the next one.
        // Edit dialogs are per-row instances, so leave those alone.
        if (next && !isEdit) setLeadId('');
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-md bg-tenant-accent px-3 text-sm text-white hover:bg-tenant-accent/90"
          >
            <Plus className="h-4 w-4" /> Add entry
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-tenant-display text-tenant-ink">
            {isEdit ? 'Edit entry' : 'Add entry'}
          </DialogTitle>
          <DialogDescription>Only visible to you — no one else on your team sees this.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Type</Label>
              <Select id="type" name="type" defaultValue={entry?.type ?? 'income'}>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={entry?.amount}
                required
              />
              {state.fieldErrors?.amount && (
                <p className="mt-1 text-xs text-destructive">{state.fieldErrors.amount}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              name="category"
              list="finance-categories"
              defaultValue={entry?.category}
              placeholder="e.g. Commission"
              required
            />
            <datalist id="finance-categories">
              {FINANCE_CATEGORIES.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="payment_method">Payment method</Label>
              <Select id="payment_method" name="payment_method" defaultValue={entry?.payment_method ?? ''}>
                <option value="">—</option>
                {FINANCE_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="entry_date">Date</Label>
              <Input
                id="entry_date"
                name="entry_date"
                type="date"
                defaultValue={entry?.entry_date ?? todayISO()}
                required
              />
            </div>
          </div>

          <div>
            <Label>Linked lead</Label>
            <LeadPicker leads={leads} value={leadId} onChange={setLeadId} />
            <input type="hidden" name="lead_id" value={leadId} />
          </div>

          <div>
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              name="note"
              rows={3}
              defaultValue={entry?.note ?? ''}
              placeholder="Optional detail"
            />
          </div>

          {state.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex gap-3">
            <Button
              type="submit"
              className="bg-tenant-accent text-white hover:bg-tenant-accent/90"
              disabled={pending}
            >
              {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add entry'}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
