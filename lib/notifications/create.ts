import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { sendTransactionalEmail } from '@/lib/email/brevo';
import { brandFromOrg } from '@/lib/branding';
import type { NotificationType } from './types';

/**
 * Notify every active staff member (admin + agent) in an org — one
 * notifications row per recipient (independent read state, mirrors
 * Slack/GitHub) plus a best-effort staff email via the same raw Brevo
 * transport account mail already uses (sendTransactionalEmail — this isn't
 * tied to a lead the way applicant-facing mail is). Never throws: a
 * notification failure shouldn't break lead capture.
 */
export async function notifyOrgStaff(params: {
  organizationId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  emailSubject?: string;
  emailBody?: string;
  /** Skip this profile — e.g. don't notify someone about their own note. */
  excludeProfileId?: string;
}): Promise<void> {
  try {
    const service = createServiceClient();
    let query = service
      .from('profiles')
      .select('id, email, full_name')
      .eq('organization_id', params.organizationId)
      .eq('is_active', true);
    if (params.excludeProfileId) query = query.neq('id', params.excludeProfileId);
    const { data: staff } = await query;
    if (!staff || staff.length === 0) return;

    await service.from('notifications').insert(
      staff.map((s) => ({
        organization_id: params.organizationId,
        profile_id: s.id,
        type: params.type,
        title: params.title,
        body: params.body ?? null,
        link: params.link ?? null,
      })),
    );

    if (params.emailSubject && params.emailBody) {
      const { data: org } = await service
        .from('organizations')
        .select('name, legal_name, sender_email')
        .eq('id', params.organizationId)
        .single();
      const senderName = org ? brandFromOrg(org).legalName : undefined;
      const senderEmail = org?.sender_email;

      await Promise.all(
        staff
          .filter((s): s is typeof s & { email: string } => !!s.email)
          .map((s) =>
            sendTransactionalEmail({
              to: s.email,
              toName: s.full_name,
              subject: params.emailSubject!,
              body: params.emailBody!,
              senderName,
              senderEmail,
            }),
          ),
      );
    }
  } catch (err) {
    console.error('[notifyOrgStaff] failed', err);
  }
}
