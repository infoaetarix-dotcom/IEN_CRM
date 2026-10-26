import 'server-only';

import { createServiceClient } from '@/lib/supabase/service';
import { notifyOrgStaff } from '@/lib/notifications/create';
import { DEFAULT_TIMEZONE, isValidTimeZone, zonedDateKey } from '@/lib/reports/time';
import { buildReminderEmail, type ReminderItem, type ReminderSlot } from './reminder-email';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

export interface ReminderRunResult {
  organizationId: string;
  sent: boolean;
  followUps: number;
  reason?: string;
}

/**
 * One reminder run (morning or afternoon) across every active org. For
 * each org, "today" is its own reporting time zone's date. Each org gets
 * at most one email per staff member per slot per day: the run is claimed
 * in follow_up_reminder_runs *before* sending, so a retry or a second
 * trigger can never email the team twice.
 *
 * Open follow-ups due today or earlier are included — overdue ones keep
 * appearing until someone marks them done. Archived leads are skipped.
 * Service role: this runs from the cron with no user session.
 */
export async function runFollowUpReminders(slot: ReminderSlot, now: Date): Promise<ReminderRunResult[]> {
  const svc = createServiceClient();

  const [{ data: orgs, error: orgErr }, { data: settings }] = await Promise.all([
    svc.from('organizations').select('id, name, legal_name, portal_domain').eq('status', 'active'),
    svc.from('reporting_settings').select('organization_id, timezone'),
  ]);
  if (orgErr) throw new Error(`reminders: could not load organizations (${orgErr.message})`);
  const tzByOrg = new Map((settings ?? []).map((s) => [s.organization_id, s.timezone]));

  const results: ReminderRunResult[] = [];
  for (const org of orgs ?? []) {
    const tzSetting = tzByOrg.get(org.id);
    const tz = tzSetting && isValidTimeZone(tzSetting) ? tzSetting : DEFAULT_TIMEZONE;
    const todayKey = zonedDateKey(now, tz);

    const { data: rows, error } = await svc
      .from('follow_ups')
      .select(
        'id, due_date, note, lead_id, application_id, leads(lead_number, full_name, archived_at), applications(application_number, full_name, leads(full_name), universities(name))',
      )
      .eq('organization_id', org.id)
      .is('completed_at', null)
      .lte('due_date', todayKey)
      .order('due_date');
    if (error) {
      results.push({ organizationId: org.id, sent: false, followUps: 0, reason: error.message });
      continue;
    }

    const items: ReminderItem[] = [];
    for (const r of rows ?? []) {
      const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
      if (r.lead_id) {
        const lead = one(r.leads);
        if (!lead || lead.archived_at) continue;
        items.push({ kind: 'lead', id: r.lead_id, number: lead.lead_number, name: lead.full_name ?? '', university: null, dueDate: r.due_date, note: r.note });
      } else if (r.application_id) {
        const app = one(r.applications);
        if (!app) continue;
        items.push({
          kind: 'application',
          id: r.application_id,
          number: app.application_number,
          name: app.full_name || one(app.leads)?.full_name || '',
          university: one(app.universities)?.name ?? null,
          dueDate: r.due_date,
          note: r.note,
        });
      }
    }
    if (!items.length) {
      results.push({ organizationId: org.id, sent: false, followUps: 0, reason: 'nothing due' });
      continue;
    }

    // Claim this org's slot for today; a duplicate key means it already went out.
    const { error: claimErr } = await svc
      .from('follow_up_reminder_runs')
      .insert({ organization_id: org.id, run_date: todayKey, slot, follow_up_count: items.length });
    if (claimErr) {
      results.push({
        organizationId: org.id,
        sent: false,
        followUps: items.length,
        reason: claimErr.code === '23505' ? 'already sent' : claimErr.message,
      });
      continue;
    }

    const appUrl = org.portal_domain ? `https://${org.portal_domain}` : APP_URL;
    const email = buildReminderEmail({ items, slot, todayKey, orgName: org.legal_name || org.name, appUrl });
    await notifyOrgStaff({
      organizationId: org.id,
      type: 'follow_up_due',
      title: email.title,
      body: email.body,
      link: '/leads?followup=any',
      emailSubject: email.subject,
      emailBody: email.html,
      emailBodyIsHtml: true,
    });
    results.push({ organizationId: org.id, sent: true, followUps: items.length });
  }
  return results;
}
