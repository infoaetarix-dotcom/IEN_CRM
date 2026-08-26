import 'server-only';

import { createClient } from '@/lib/supabase/server';
import { registerTools, type ToolExecutionResult } from './registry';
import { resolveLead } from './leads';

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

/**
 * Both tools here are requiresConfirmation: true — execute() only resolves
 * the recipient and validates there's something to send. It NEVER calls the
 * real send action. The turn loop (app/api/chatbot/route.ts) is what
 * enforces this stays a draft: it persists a pending row and stops instead
 * of sending, and only a real button click in confirm-card.tsx (via
 * confirmChatbotAction) can turn a draft into an actual send.
 */
registerTools([
  {
    name: 'draft_and_send_email',
    description: 'Draft (or rewrite from a hint) an email to a lead. Always shown to the user for confirmation before anything is sent — never sends by itself.',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        lead_id: { type: 'string' },
        lead_name: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string', description: 'The full drafted message' },
      },
      required: ['subject', 'body'],
    },
    async execute(args): Promise<ToolExecutionResult> {
      const lead = await resolveLead(args);
      if (!lead.ok) return { ok: false, summary: lead.error };

      const supabase = await createClient();
      const { data } = await supabase.from('leads').select('email').eq('id', lead.id).maybeSingle();
      if (!data?.email) return { ok: false, summary: `${lead.fullName} has no email address on file.` };

      return {
        ok: true,
        summary: `Drafted an email to ${lead.fullName} — waiting for you to confirm before sending.`,
        data: {
          leadId: lead.id,
          to: data.email,
          subject: str(args.subject),
          body: str(args.body),
        },
      };
    },
  },

  {
    name: 'draft_and_send_whatsapp',
    description: 'Draft (or rewrite from a hint) a WhatsApp message to a lead. Always shown to the user for confirmation before anything is sent — never sends by itself. Opened in WhatsApp for the user to actually press send, same as the manual WhatsApp button.',
    requiresConfirmation: true,
    parameters: {
      type: 'object',
      properties: {
        lead_id: { type: 'string' },
        lead_name: { type: 'string' },
        message: { type: 'string', description: 'The full drafted message' },
      },
      required: ['message'],
    },
    async execute(args): Promise<ToolExecutionResult> {
      const lead = await resolveLead(args);
      if (!lead.ok) return { ok: false, summary: lead.error };

      const supabase = await createClient();
      const { data } = await supabase.from('leads').select('phone').eq('id', lead.id).maybeSingle();
      if (!data?.phone) return { ok: false, summary: `${lead.fullName} has no phone number on file.` };

      return {
        ok: true,
        summary: `Drafted a WhatsApp message to ${lead.fullName} — waiting for you to confirm before opening it.`,
        data: {
          leadId: lead.id,
          to: data.phone,
          body: str(args.message),
        },
      };
    },
  },
]);
