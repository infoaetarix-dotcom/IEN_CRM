import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { createQuery, updateLeadStatus, type CreateQueryState } from '@/app/(admin)/leads/actions';
import { createApplication, getLeadDefaultsForApplication, type ActionState } from '@/app/(admin)/applications/actions';
import { LEAD_STATUSES, isLeadStatus } from '@/lib/leads/display';
import { runGuarded } from '@/lib/chatbot/run-guarded';
import { registerTools, type ToolContext, type ToolExecutionResult } from './registry';

/**
 * Most tools take either a lead_id (if the caller already resolved one,
 * e.g. chained from find_lead) or a lead_name to search for — natural
 * language virtually never comes with a UUID attached. Returns the single
 * match, or an ok:false result the model can relay back to the user
 * (not found / ambiguous — asking for a more specific name or an id).
 */
export async function resolveLead(
  args: { lead_id?: unknown; lead_name?: unknown },
): Promise<{ ok: true; id: string; organizationId: string; fullName: string } | { ok: false; error: string }> {
  const supabase = await createClient();

  if (typeof args.lead_id === 'string' && args.lead_id) {
    const { data } = await supabase
      .from('leads')
      .select('id, organization_id, full_name')
      .eq('id', args.lead_id)
      .maybeSingle();
    if (!data) return { ok: false, error: 'No lead found with that id.' };
    return { ok: true, id: data.id, organizationId: data.organization_id, fullName: data.full_name };
  }

  const name = typeof args.lead_name === 'string' ? args.lead_name.trim() : '';
  if (!name) return { ok: false, error: 'Which lead? Give a name or id.' };

  const { data } = await supabase
    .from('leads')
    .select('id, organization_id, full_name')
    .ilike('full_name', `%${name}%`)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  if (!data || data.length === 0) return { ok: false, error: `No lead found matching "${name}".` };
  if (data.length > 1) {
    return {
      ok: false,
      error: `Multiple leads match "${name}": ${data.map((l) => l.full_name).join(', ')}. Ask which one, or use their exact full name.`,
    };
  }
  const lead = data[0]!;
  return { ok: true, id: lead.id, organizationId: lead.organization_id, fullName: lead.full_name };
}

function toFormData(fields: Record<string, string | undefined>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null && v !== '') fd.set(k, v);
  }
  return fd;
}

registerTools([
  {
    name: 'find_lead',
    description: 'Search this organization\'s leads by name. Use this to resolve a lead the user refers to by name before updating it.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Full or partial name to search for' } },
      required: ['query'],
    },
    async execute(args): Promise<ToolExecutionResult> {
      const query = typeof args.query === 'string' ? args.query.trim() : '';
      if (!query) return { ok: false, summary: 'No search text given.' };
      const supabase = await createClient();
      const { data } = await supabase
        .from('leads')
        .select('id, full_name, email, phone, status')
        .ilike('full_name', `%${query}%`)
        .is('archived_at', null)
        .limit(5);
      if (!data || data.length === 0) {
        return { ok: true, summary: `No leads found matching "${query}".`, data: { matches: [] } };
      }
      return {
        ok: true,
        summary: `Found ${data.length} lead(s) matching "${query}": ${data.map((l) => l.full_name).join(', ')}.`,
        data: { matches: data },
      };
    },
  },

  {
    name: 'create_lead',
    description: 'Create a new lead/query from details the user gave you, e.g. from a name and a few facts, or from a "create a lead for X" instruction. Does not require consent to be captured here.',
    parameters: {
      type: 'object',
      properties: {
        full_name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string', description: 'E.164 format if known, e.g. +923001234567' },
        target_country: { type: 'string' },
        city: { type: 'string' },
        district: { type: 'string' },
        institution: { type: 'string', description: 'Preferred institution abroad' },
        program: { type: 'string' },
        highest_education: { type: 'string' },
        last_qualification: { type: 'string' },
        passport_number: { type: 'string' },
        utm_source: { type: 'string', description: 'Where this lead came from, if known' },
      },
      required: ['full_name'],
    },
    async execute(args, ctx: ToolContext): Promise<ToolExecutionResult> {
      const fd = toFormData({
        full_name: str(args.full_name),
        email: str(args.email),
        phone: str(args.phone),
        target_country: str(args.target_country),
        city: str(args.city),
        district: str(args.district),
        institution: str(args.institution),
        program: str(args.program),
        highest_education: str(args.highest_education),
        last_qualification: str(args.last_qualification),
        passport_number: str(args.passport_number),
        utm_source: str(args.utm_source),
      });
      void ctx;
      const outcome = await runGuarded(() => createQuery({ ok: false } as CreateQueryState, fd));
      if (!outcome.ok) return { ok: false, summary: outcome.error };
      if (!outcome.result.ok) return { ok: false, summary: outcome.result.error ?? 'Could not create the lead.' };
      return {
        ok: true,
        summary: `Created lead "${str(args.full_name)}".`,
        data: { leadId: outcome.result.leadId },
      };
    },
  },

  {
    name: 'update_lead_status',
    description: `Change a lead's pipeline status. Valid statuses: ${LEAD_STATUSES.join(', ')}.`,
    parameters: {
      type: 'object',
      properties: {
        lead_id: { type: 'string' },
        lead_name: { type: 'string' },
        status: { type: 'string', enum: [...LEAD_STATUSES] },
      },
      required: ['status'],
    },
    async execute(args): Promise<ToolExecutionResult> {
      const status = str(args.status);
      if (!isLeadStatus(status)) return { ok: false, summary: `Invalid status "${status}".` };
      const lead = await resolveLead(args);
      if (!lead.ok) return { ok: false, summary: lead.error };

      const outcome = await runGuarded(() => updateLeadStatus(lead.id, status));
      if (!outcome.ok) return { ok: false, summary: outcome.error };
      if (!outcome.result.ok) return { ok: false, summary: outcome.result.error ?? 'Could not update status.' };
      return { ok: true, summary: `${lead.fullName}'s status is now "${status}".` };
    },
  },

  {
    name: 'create_application',
    description: 'Generate an application for a lead at a specific university (the university must already exist — use find_university / create_university first if needed). Copies the lead\'s own details as a starting point.',
    parameters: {
      type: 'object',
      properties: {
        lead_id: { type: 'string' },
        lead_name: { type: 'string' },
        university_id: { type: 'string', description: 'Resolved via find_university or create_university' },
        program: { type: 'string', description: 'Overrides the program copied from the lead, if given' },
      },
      required: ['university_id'],
    },
    async execute(args): Promise<ToolExecutionResult> {
      const universityId = str(args.university_id);
      if (!universityId) return { ok: false, summary: 'No university_id given — resolve one with find_university or create_university first.' };

      const lead = await resolveLead(args);
      if (!lead.ok) return { ok: false, summary: lead.error };

      const defaultsOutcome = await runGuarded(() => getLeadDefaultsForApplication(lead.id));
      if (!defaultsOutcome.ok) return { ok: false, summary: defaultsOutcome.error };
      if (!defaultsOutcome.result.ok) return { ok: false, summary: defaultsOutcome.result.error };
      const defaults = defaultsOutcome.result.values;

      const fd = toFormData({
        full_name: defaults.full_name,
        email: defaults.email,
        phone: defaults.phone,
        date_of_birth: defaults.date_of_birth,
        city: defaults.city,
        district: defaults.district,
        target_country: defaults.target_country,
        university_id: universityId,
        program: str(args.program) || defaults.program,
        intake_season: defaults.intake_season,
        intake_year: defaults.intake_year,
        highest_education: defaults.highest_education,
        last_qualification: defaults.last_qualification,
        prior_institution: defaults.prior_institution,
        passing_year: defaults.passing_year,
        grading_system: defaults.grading_system,
        grade_value: defaults.grade_value,
        work_experience_years: defaults.work_experience_years,
        work_experience_detail: defaults.work_experience_detail,
        english_test: defaults.english_test,
        english_score: defaults.english_score,
        funding_source: defaults.funding_source,
        prior_rejection: defaults.prior_rejection ? 'on' : undefined,
        prior_rejection_detail: defaults.prior_rejection_detail,
        passport_number: defaults.passport_number,
        status: 'new',
      });

      const outcome = await runGuarded(() =>
        createApplication(lead.id, { ok: false } as ActionState, fd),
      );
      if (!outcome.ok) return { ok: false, summary: outcome.error };
      if (!outcome.result.ok) return { ok: false, summary: outcome.result.error ?? 'Could not create the application.' };
      return {
        ok: true,
        summary: `Created an application for ${lead.fullName}.`,
        data: { applicationId: outcome.result.applicationId },
      };
    },
  },
]);

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}
