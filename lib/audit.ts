import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';

export type AuditAction =
  | 'lead_created'
  | 'status_change'
  | 'message_sent'
  | 'message_failed'
  | 'lead_assigned'
  | 'note_added'
  | 'profile_change'
  | 'login';

export type AuditEntity = 'lead' | 'message' | 'profile';

/**
 * Append an audit-log row. Best-effort: auditing must never break the action
 * it records, so failures are swallowed (and logged to the server console).
 * Uses the service role since audit_log has no insert policy for end users.
 */
export async function writeAuditLog(params: {
  actorId: string | null;
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from('audit_log').insert({
      actor_id: params.actorId,
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? {},
    });
  } catch (err) {
    console.error('[audit] failed to write audit log', err);
  }
}
