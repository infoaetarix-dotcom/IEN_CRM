import 'server-only';

import { findUniversityByName, createUniversity, type SettingsActionState } from '@/app/(admin)/settings/actions';
import { runGuarded } from '@/lib/chatbot/run-guarded';
import { registerTools, type ToolExecutionResult } from './registry';

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

registerTools([
  {
    name: 'find_university',
    description: 'Search this organization\'s saved universities by name. Always try this before create_university — never create a duplicate of one that already exists.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Full or partial university name' } },
      required: ['query'],
    },
    async execute(args): Promise<ToolExecutionResult> {
      const query = str(args.query).trim();
      if (!query) return { ok: false, summary: 'No search text given.' };
      const outcome = await runGuarded(() => findUniversityByName(query));
      if (!outcome.ok) return { ok: false, summary: outcome.error };
      if (outcome.result.length === 0) {
        return { ok: true, summary: `No saved university matches "${query}".`, data: { matches: [] } };
      }
      return {
        ok: true,
        summary: `Found: ${outcome.result.map((u) => `${u.name} (${u.country})`).join(', ')}.`,
        data: { matches: outcome.result },
      };
    },
  },

  {
    name: 'create_university',
    description: 'Add a new university to Settings so applications can be created against it. Always call find_university first to avoid creating a duplicate.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        country: { type: 'string' },
      },
      required: ['name', 'country'],
    },
    async execute(args): Promise<ToolExecutionResult> {
      const fd = new FormData();
      fd.set('name', str(args.name));
      fd.set('country', str(args.country));

      const outcome = await runGuarded(() => createUniversity({ ok: false } as SettingsActionState, fd));
      if (!outcome.ok) return { ok: false, summary: outcome.error };
      if (!outcome.result.ok) return { ok: false, summary: outcome.result.error ?? 'Could not create the university.' };
      return {
        ok: true,
        summary: `Added "${str(args.name)}" (${str(args.country)}).`,
        data: { universityId: outcome.result.universityId },
      };
    },
  },
]);
