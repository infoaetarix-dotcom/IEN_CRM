import 'server-only';

import { createStudentFinanceEntry, type StudentFinanceActionState } from '@/app/(admin)/student-finance/actions';
import { createFinanceEntry, type FinanceActionState } from '@/app/(admin)/finance/actions';
import { runGuarded } from '@/lib/chatbot/run-guarded';
import { registerTools, type ToolExecutionResult } from './registry';
import { resolveLead } from './leads';

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

registerTools([
  {
    name: 'add_student_finance_entry',
    description: 'Add a payment (fee, deposit, etc.) to the shared Student Finance ledger for a specific student. Available to admins and agents.',
    parameters: {
      type: 'object',
      properties: {
        lead_id: { type: 'string' },
        lead_name: { type: 'string', description: 'Which student this payment is for' },
        type: { type: 'string', enum: ['income', 'expense'] },
        amount: { type: 'number' },
        category: { type: 'string', description: 'e.g. Tuition fee, Deposit, Visa fee' },
        payment_method: { type: 'string' },
        note: { type: 'string' },
        entry_date: { type: 'string', description: 'YYYY-MM-DD, defaults to today' },
      },
      required: ['type', 'amount', 'category'],
    },
    async execute(args): Promise<ToolExecutionResult> {
      const lead = await resolveLead(args);
      if (!lead.ok) return { ok: false, summary: lead.error };

      const fd = new FormData();
      fd.set('lead_id', lead.id);
      fd.set('type', str(args.type));
      fd.set('amount', str(args.amount));
      fd.set('category', str(args.category));
      if (str(args.payment_method)) fd.set('payment_method', str(args.payment_method));
      if (str(args.note)) fd.set('note', str(args.note));
      fd.set('entry_date', str(args.entry_date) || today());

      const outcome = await runGuarded(() =>
        createStudentFinanceEntry({ ok: false } as StudentFinanceActionState, fd),
      );
      if (!outcome.ok) return { ok: false, summary: outcome.error };
      if (!outcome.result.ok) return { ok: false, summary: outcome.result.error ?? 'Could not save this entry.' };
      return { ok: true, summary: `Logged ${str(args.type)} of ${str(args.amount)} for ${lead.fullName}.` };
    },
  },

  {
    name: 'add_finance_entry',
    description: 'Add an entry to the caller\'s own private Finance ledger. Admin only — an agent asking for this must be rejected.',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['income', 'expense'] },
        amount: { type: 'number' },
        category: { type: 'string' },
        payment_method: { type: 'string' },
        note: { type: 'string' },
        entry_date: { type: 'string', description: 'YYYY-MM-DD, defaults to today' },
      },
      required: ['type', 'amount', 'category'],
    },
    async execute(args): Promise<ToolExecutionResult> {
      const fd = new FormData();
      fd.set('type', str(args.type));
      fd.set('amount', str(args.amount));
      fd.set('category', str(args.category));
      if (str(args.payment_method)) fd.set('payment_method', str(args.payment_method));
      if (str(args.note)) fd.set('note', str(args.note));
      fd.set('entry_date', str(args.entry_date) || today());

      // requireFinanceAccess() inside createFinanceEntry is the real
      // boundary here (admin-only + module check) — runGuarded is what
      // turns its redirect() into a clean rejection instead of hijacking
      // the response when an agent's request reaches this tool.
      const outcome = await runGuarded(() => createFinanceEntry({ ok: false } as FinanceActionState, fd));
      if (!outcome.ok) return { ok: false, summary: outcome.error };
      if (!outcome.result.ok) return { ok: false, summary: outcome.result.error ?? 'Could not save this entry.' };
      return { ok: true, summary: `Logged ${str(args.type)} of ${str(args.amount)}.` };
    },
  },
]);
