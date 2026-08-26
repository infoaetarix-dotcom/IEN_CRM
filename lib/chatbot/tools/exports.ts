import 'server-only';

import { requireFinanceAccess } from '@/lib/finance/guard';
import { runGuarded } from '@/lib/chatbot/run-guarded';
import { registerTools, type ToolExecutionResult } from './registry';

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

/**
 * Export tools never fetch the file themselves — they hand the client a URL
 * to open (the panel renders it as a download link), since the response is
 * binary (.xlsx / .pdf), not something to feed back into the model.
 */
registerTools([
  {
    name: 'export_leads_excel',
    description: 'Get a download link for the current leads list as an Excel file, optionally filtered by status/source/date range.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by lead status, if given' },
        source: { type: 'string', description: 'Filter by lead source, if given' },
        from: { type: 'string', description: 'YYYY-MM-DD — start of date range' },
        to: { type: 'string', description: 'YYYY-MM-DD — end of date range' },
      },
    },
    async execute(args): Promise<ToolExecutionResult> {
      const params = new URLSearchParams();
      if (str(args.status)) params.set('status', str(args.status));
      if (str(args.source)) params.set('source', str(args.source));
      if (str(args.from)) params.set('from', str(args.from));
      if (str(args.to)) params.set('to', str(args.to));
      const url = `/api/leads/export${params.toString() ? `?${params}` : ''}`;
      return { ok: true, summary: 'Here is your leads export.', data: { downloadUrl: url } };
    },
  },

  {
    name: 'export_finance_statement',
    description: 'Get a download link for the caller\'s own Finance statement (PDF), optionally for a specific date range, e.g. "1 May to 30 May". Admin only.',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'YYYY-MM-DD — start of range' },
        to: { type: 'string', description: 'YYYY-MM-DD — end of range' },
      },
    },
    async execute(args): Promise<ToolExecutionResult> {
      // Same boundary the route itself enforces (admin + finance module) —
      // checked here too so an agent gets a clean chat rejection instead of
      // a download link that silently redirects when clicked.
      const access = await runGuarded(() => requireFinanceAccess());
      if (!access.ok) return { ok: false, summary: access.error };

      const params = new URLSearchParams();
      if (str(args.from) && str(args.to)) {
        params.set('from', str(args.from));
        params.set('to', str(args.to));
      }
      const url = `/api/finance/statement${params.toString() ? `?${params}` : ''}`;
      return { ok: true, summary: 'Here is your finance statement.', data: { downloadUrl: url } };
    },
  },
]);
