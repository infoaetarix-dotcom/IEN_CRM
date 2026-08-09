export type FinanceEntryType = 'income' | 'expense';

export interface FinanceEntry {
  id: string;
  type: FinanceEntryType;
  amount: number;
  category: string;
  payment_method: string | null;
  note: string | null;
  lead_id: string | null;
  lead_name?: string | null;
  entry_date: string;
  created_at: string;
}

/** Common presets shown in the category picker — the field also accepts free text. */
export const FINANCE_CATEGORIES = [
  'Client Payment',
  'Commission',
  'Office Rent',
  'Salary',
  'Utilities',
  'Marketing',
  'Travel',
  'Supplies',
  'Refund',
  'Other',
] as const;

export const FINANCE_PAYMENT_METHODS = [
  'Cash',
  'Bank Transfer',
  'JazzCash',
  'Easypaisa',
  'Cheque',
  'Card',
] as const;

export function formatAmount(amount: number): string {
  return `Rs ${amount.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * The `leads(full_name)` embedded-relation select comes back as an array on
 * the untyped client regardless of the FK being to-one — normalize either
 * shape to a single name.
 */
export function extractLeadName(leads: unknown): string | null {
  const row = Array.isArray(leads) ? leads[0] : leads;
  return (row as { full_name?: string } | null | undefined)?.full_name ?? null;
}
