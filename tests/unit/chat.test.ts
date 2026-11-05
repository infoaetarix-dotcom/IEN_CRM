import { describe, it, expect } from 'vitest';
import {
  tickStatus,
  receiptsFor,
  isOnline,
  lastSeenLabel,
  shouldEmail,
  chatNotificationTitle,
} from '@/lib/chat/status';

const at = (s: string) => `2026-11-04T${s}:00.000Z`;

describe('tickStatus (WhatsApp ticks)', () => {
  const sent = at('10:00');
  const me = { profile_id: 'me', last_delivered_at: at('10:00'), last_read_at: at('10:00') };

  it('one tick until delivered, two when delivered, blue when seen', () => {
    expect(tickStatus(sent, 'me', [me, { profile_id: 'a', last_delivered_at: at('09:00'), last_read_at: at('09:00') }])).toBe('sent');
    expect(tickStatus(sent, 'me', [me, { profile_id: 'a', last_delivered_at: at('10:01'), last_read_at: at('09:00') }])).toBe('delivered');
    expect(tickStatus(sent, 'me', [me, { profile_id: 'a', last_delivered_at: at('10:02'), last_read_at: at('10:02') }])).toBe('read');
  });

  it('in a group, needs everyone for two ticks and everyone for blue', () => {
    const a = { profile_id: 'a', last_delivered_at: at('10:01'), last_read_at: at('10:01') };
    const b = { profile_id: 'b', last_delivered_at: at('09:00'), last_read_at: at('09:00') };
    expect(tickStatus(sent, 'me', [me, a, b])).toBe('sent');
    expect(tickStatus(sent, 'me', [me, a, { ...b, last_delivered_at: at('10:05') }])).toBe('delivered');
    expect(tickStatus(sent, 'me', [me, a, { ...b, last_delivered_at: at('10:05'), last_read_at: at('10:06') }])).toBe('read');
  });

  it('lists who has seen / received a group message', () => {
    const r = receiptsFor(sent, 'me', [
      me,
      { profile_id: 'a', last_delivered_at: at('10:01'), last_read_at: at('10:03') },
      { profile_id: 'b', last_delivered_at: at('10:02'), last_read_at: at('09:00') },
      { profile_id: 'c', last_delivered_at: at('09:00'), last_read_at: at('09:00') },
    ]);
    expect(r).toEqual([
      { profile_id: 'a', state: 'read', at: at('10:03') },
      { profile_id: 'b', state: 'delivered', at: at('10:02') },
      { profile_id: 'c', state: 'sent', at: null },
    ]);
  });
});

describe('online and last seen', () => {
  const now = new Date('2026-11-04T10:00:00Z');
  it('online within 90 seconds of the last heartbeat', () => {
    expect(isOnline('2026-11-04T09:59:00Z', now.getTime())).toBe(true);
    expect(isOnline('2026-11-04T09:58:00Z', now.getTime())).toBe(false);
    expect(isOnline(null, now.getTime())).toBe(false);
  });
  it('labels', () => {
    expect(lastSeenLabel('2026-11-04T09:59:30Z', now, 'Asia/Karachi')).toBe('Online');
    expect(lastSeenLabel('2026-11-04T08:40:00Z', now, 'Asia/Karachi')).toBe('Last seen today at 1:40 pm');
    expect(lastSeenLabel('2026-11-03T08:40:00Z', now, 'Asia/Karachi')).toBe('Last seen yesterday at 1:40 pm');
    expect(lastSeenLabel('2026-10-12T08:40:00Z', now, 'Asia/Karachi')).toBe('Last seen 12 Oct');
  });
});

describe('shouldEmail', () => {
  it('emails once per unread streak, and not while online', () => {
    expect(shouldEmail({ last_read_at: at('09:00'), last_emailed_at: null }, false)).toBe(true);
    // Emailed at 10:00, hasn't read since → no more emails.
    expect(shouldEmail({ last_read_at: at('09:00'), last_emailed_at: at('10:00') }, false)).toBe(false);
    // Read at 10:30 → the next message emails again.
    expect(shouldEmail({ last_read_at: at('10:30'), last_emailed_at: at('10:00') }, false)).toBe(true);
    expect(shouldEmail({ last_read_at: at('09:00'), last_emailed_at: null }, true)).toBe(false);
  });
});

describe('notification wording never includes the message', () => {
  it('direct and group', () => {
    expect(chatNotificationTitle('Rafi Adnan', null)).toBe('You have a new message from Rafi Adnan');
    expect(chatNotificationTitle('Rafi Adnan', 'Admissions team')).toBe('Rafi Adnan sent a message in Admissions team');
  });
});
