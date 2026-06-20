'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireUser, requireRole } from '@/lib/auth/guards';
import { writeAuditLog } from '@/lib/audit';
import { isLeadStatus } from '@/lib/leads/display';
import { sendEmail, renderTemplate } from '@/lib/email/brevo';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Change a lead's status. The user-session client performs the update so RLS
 * gates access (admin OR assigned agent). History + audit are written with the
 * service role afterwards — only once the gated update has succeeded.
 */
export async function updateLeadStatus(
  leadId: string,
  toStatus: string,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!isLeadStatus(toStatus)) return { ok: false, error: 'Invalid status.' };

  const supabase = await createClient();

  // Read current status under RLS — null means no access / not found.
  const { data: existing } = await supabase
    .from('leads')
    .select('status')
    .eq('id', leadId)
    .single();
  if (!existing) return { ok: false, error: 'Lead not found or access denied.' };
  if (existing.status === toStatus) return { ok: true };

  const { error: updErr } = await supabase
    .from('leads')
    .update({ status: toStatus })
    .eq('id', leadId);
  if (updErr) return { ok: false, error: 'Could not update status.' };

  // History + audit (service role; tables have no end-user insert policy).
  const service = createServiceClient();
  await service.from('lead_status_history').insert({
    lead_id: leadId,
    from_status: existing.status,
    to_status: toStatus,
    changed_by: user.id,
  });
  await writeAuditLog({
    actorId: user.id,
    action: 'status_change',
    entity: 'lead',
    entityId: leadId,
    metadata: { from: existing.status, to: toStatus },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/leads');
  return { ok: true };
}

const noteSchema = z.string().trim().min(1, 'Note cannot be empty').max(2000);

/** Append a note. RLS (notes_insert) enforces author + lead access. */
export async function addNote(
  leadId: string,
  body: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const supabase = await createClient();
  const { error } = await supabase.from('lead_notes').insert({
    lead_id: leadId,
    author_id: user.id,
    body: parsed.data,
  });
  if (error) return { ok: false, error: 'Could not add note (access denied?).' };

  await writeAuditLog({
    actorId: user.id,
    action: 'note_added',
    entity: 'lead',
    entityId: leadId,
  });

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}

/** Assign a lead to an agent (admin only). */
export async function assignLead(
  leadId: string,
  agentId: string | null,
): Promise<ActionResult> {
  const admin = await requireRole('admin');
  const supabase = await createClient();

  const { error } = await supabase
    .from('leads')
    .update({ assigned_to: agentId })
    .eq('id', leadId);
  if (error) return { ok: false, error: 'Could not assign lead.' };

  await writeAuditLog({
    actorId: admin.id,
    action: 'lead_assigned',
    entity: 'lead',
    entityId: leadId,
    metadata: { assigned_to: agentId },
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath('/leads');
  return { ok: true };
}

/**
 * Send a templated email from a lead's profile (Phase 3 UI uses this).
 * Verifies lead access via RLS, renders from the allow-list, logs + audits.
 */
export async function sendLeadEmail(
  leadId: string,
  templateKey: string,
): Promise<ActionResult> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from('leads')
    .select('id, full_name, email, target_country, program, institution')
    .eq('id', leadId)
    .single();
  if (!lead) return { ok: false, error: 'Lead not found or access denied.' };

  const { data: tpl } = await supabase
    .from('email_templates')
    .select('subject, body')
    .eq('key', templateKey)
    .single();
  if (!tpl) return { ok: false, error: 'Template not found.' };

  const vars = {
    full_name: lead.full_name,
    program: lead.program,
    target_country: lead.target_country,
    institution: lead.institution,
  };

  const res = await sendEmail({
    leadId: lead.id,
    to: lead.email,
    toName: lead.full_name,
    subject: renderTemplate(tpl.subject, vars),
    body: renderTemplate(tpl.body, vars),
    templateKey,
    sentBy: user.id,
  });

  await writeAuditLog({
    actorId: user.id,
    action: res.ok ? 'message_sent' : 'message_failed',
    entity: 'message',
    entityId: res.messageId || null,
    metadata: { leadId, templateKey, error: res.error },
  });

  revalidatePath(`/leads/${leadId}`);
  if (!res.ok) return { ok: false, error: res.error ?? 'Send failed.' };
  return { ok: true };
}
