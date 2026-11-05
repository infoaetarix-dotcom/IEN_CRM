/**
 * Team chat rules that don't touch the database — ticks, online status,
 * when to email, and notification wording. Pure, so they're unit-tested.
 * See 0051_team_chat.sql for how the timestamps are kept.
 */

export type TickStatus = 'sent' | 'delivered' | 'read';

export interface MemberReceipt {
  profile_id: string;
  last_delivered_at: string;
  last_read_at: string;
}

/**
 * WhatsApp ticks for a message the viewer sent: ✓ sent, ✓✓ delivered to
 * every other member, blue ✓✓ seen by every other member. In a group, one
 * member who hasn't received it keeps it at one tick.
 */
export function tickStatus(messageAt: string, senderId: string, members: MemberReceipt[]): TickStatus {
  const others = members.filter((m) => m.profile_id !== senderId);
  if (others.length === 0) return 'read';
  const t = Date.parse(messageAt);
  if (others.every((m) => Date.parse(m.last_read_at) >= t)) return 'read';
  if (others.every((m) => Date.parse(m.last_delivered_at) >= t)) return 'delivered';
  return 'sent';
}

/** Who has seen / received a message — the "message info" list in groups. */
export function receiptsFor(messageAt: string, senderId: string, members: MemberReceipt[]) {
  const t = Date.parse(messageAt);
  return members
    .filter((m) => m.profile_id !== senderId)
    .map((m) => ({
      profile_id: m.profile_id,
      state: (Date.parse(m.last_read_at) >= t ? 'read' : Date.parse(m.last_delivered_at) >= t ? 'delivered' : 'sent') as TickStatus,
      at: Date.parse(m.last_read_at) >= t ? m.last_read_at : Date.parse(m.last_delivered_at) >= t ? m.last_delivered_at : null,
    }));
}

/** The CRM beats every 30s while open; a minute and a half of silence means offline. */
export const ONLINE_WINDOW_MS = 90_000;

export function isOnline(lastSeenAt: string | null | undefined, now: number = Date.now()): boolean {
  return !!lastSeenAt && now - Date.parse(lastSeenAt) < ONLINE_WINDOW_MS;
}

/** "Online", "Last seen today at 3:40 pm", "Last seen yesterday at …", "Last seen 12 Oct". */
export function lastSeenLabel(lastSeenAt: string | null | undefined, now: Date = new Date(), tz?: string): string {
  if (!lastSeenAt) return 'Not seen yet';
  if (isOnline(lastSeenAt, now.getTime())) return 'Online';
  const seen = new Date(lastSeenAt);
  const day = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: tz });
  const time = seen.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz });
  if (day(seen) === day(now)) return `Last seen today at ${time}`;
  if (day(seen) === day(new Date(now.getTime() - 86_400_000))) return `Last seen yesterday at ${time}`;
  return `Last seen ${seen.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: tz })}`;
}

/**
 * Whether to email a recipient about a new message. At most one email per
 * unread streak — nothing more until they've read the conversation since
 * the last email — and never while they're online (they're notified in the
 * app; a live back-and-forth shouldn't email every reply).
 */
export function shouldEmail(member: { last_read_at: string; last_emailed_at: string | null }, online: boolean): boolean {
  if (online) return false;
  if (!member.last_emailed_at) return true;
  return Date.parse(member.last_read_at) > Date.parse(member.last_emailed_at);
}

/** Notification / email wording. Never includes what the message says. */
export function chatNotificationTitle(senderName: string, group: string | null): string {
  return group ? `${senderName} sent a message in ${group}` : `You have a new message from ${senderName}`;
}

export function chatLink(conversationId: string): string {
  return `/messages?c=${conversationId}`;
}
