import { daysBetween, formatDueDate } from './status';

/**
 * The follow-up summary email every staff member gets (morning and
 * afternoon). Pure: the cron gathers the rows, this builds the message.
 * Everything interpolated is HTML-escaped — names and notes are staff /
 * applicant input.
 */

export type ReminderSlot = 'morning' | 'afternoon';

export interface ReminderItem {
  kind: 'lead' | 'application';
  /** Lead or application id, for the link. */
  id: string;
  /** e.g. "#34" — lead_number / application_number. */
  number: number | null;
  name: string;
  /** Applications only. */
  university: string | null;
  dueDate: string;
  note: string | null;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function buildReminderEmail(params: {
  items: ReminderItem[];
  slot: ReminderSlot;
  todayKey: string;
  orgName: string;
  appUrl: string;
}): { subject: string; html: string; title: string; body: string } {
  const { items, slot, todayKey, orgName, appUrl } = params;
  const today = items.filter((i) => i.dueDate === todayKey);
  const overdue = items
    .filter((i) => i.dueDate < todayKey)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const total = items.length;
  const noun = `follow-up${total === 1 ? '' : 's'}`;

  const subject =
    slot === 'afternoon'
      ? `Still open: ${total} ${noun} ${total === 1 ? 'needs' : 'need'} attention today — ${orgName}`
      : `${total} ${noun} due today — ${orgName}`;

  const row = (i: ReminderItem) => {
    const href = `${appUrl}/${i.kind === 'lead' ? 'leads' : 'applications'}/${i.id}`;
    const label = i.kind === 'lead' ? 'Lead' : 'Application';
    const late = i.dueDate < todayKey ? daysBetween(i.dueDate, todayKey) : 0;
    return `<li style="margin:0 0 10px">
  <a href="${esc(href)}" style="color:#2563eb;font-weight:600;text-decoration:none">${esc(i.name || '(no name)')}</a>
  <span style="color:#6b7a8d"> · ${label}${i.number != null ? ` #${i.number}` : ''}${i.university ? ` · ${esc(i.university)}` : ''}${
    late ? ` · due ${esc(formatDueDate(i.dueDate))} (${late} day${late === 1 ? '' : 's'} overdue)` : ''
  }</span>${i.note ? `<br/><span style="color:#0b1f33">${esc(i.note)}</span>` : ''}
</li>`;
  };

  const section = (heading: string, list: ReminderItem[]) =>
    list.length
      ? `<p style="margin:18px 0 8px;font-weight:600">${heading} (${list.length})</p><ul style="margin:0;padding-left:20px">${list
          .map(row)
          .join('')}</ul>`
      : '';

  const intro =
    slot === 'afternoon'
      ? `These follow-ups still aren’t marked done. Please follow up before the end of the day and click <strong>Mark done</strong> on each one.`
      : `Here are today’s follow-ups. Once you’ve followed up, click <strong>Mark done</strong> on the lead or application.`;

  const html = `<p style="margin:0 0 4px">${intro}</p>${section('Due today', today)}${section('Overdue', overdue)}
<p style="margin:20px 0 0"><a href="${esc(appUrl)}/leads?followup=any" style="color:#2563eb">See all open follow-ups</a></p>`;

  return {
    subject,
    html,
    title: slot === 'afternoon' ? `${total} ${noun} still open today` : `${total} ${noun} due today`,
    body: [today.length && `${today.length} due today`, overdue.length && `${overdue.length} overdue`]
      .filter(Boolean)
      .join(' · '),
  };
}
