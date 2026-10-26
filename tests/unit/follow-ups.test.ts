import { describe, it, expect } from 'vitest';
import {
  followUpState,
  addDays,
  daysBetween,
  followUpFilterRange,
  matchesFollowUpFilter,
} from '@/lib/follow-ups/status';
import { buildReminderEmail, type ReminderItem } from '@/lib/follow-ups/reminder-email';

describe('followUpState', () => {
  const today = '2026-10-28';
  it('today / overdue / upcoming', () => {
    expect(followUpState('2026-10-28', today)).toMatchObject({ kind: 'today', label: 'Follow-up today' });
    expect(followUpState('2026-10-27', today)).toMatchObject({ kind: 'overdue', daysOverdue: 1, label: 'Overdue · 1 day' });
    expect(followUpState('2026-10-20', today).label).toBe('Overdue · 8 days');
    expect(followUpState('2026-10-29', today)).toMatchObject({ kind: 'upcoming', label: 'Follow-up Thu 29 Oct' });
  });

  it('date maths across month and year ends', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
  });
});

describe('follow-up filters', () => {
  const today = '2026-10-28';
  it('ranges', () => {
    expect(followUpFilterRange('today', today)).toEqual({ from: today, to: today });
    expect(followUpFilterRange('overdue', today)).toEqual({ from: null, to: '2026-10-27' });
    expect(followUpFilterRange('week', today)).toEqual({ from: today, to: '2026-11-04' });
  });
  it('matches', () => {
    expect(matchesFollowUpFilter('2026-10-27', 'overdue', today)).toBe(true);
    expect(matchesFollowUpFilter('2026-10-28', 'overdue', today)).toBe(false);
    expect(matchesFollowUpFilter('2026-11-04', 'week', today)).toBe(true); // "In 1 week"
    expect(matchesFollowUpFilter('2026-11-05', 'week', today)).toBe(false);
    expect(matchesFollowUpFilter('2020-01-01', 'any', today)).toBe(true);
  });
});

describe('buildReminderEmail', () => {
  const items: ReminderItem[] = [
    { kind: 'lead', id: 'l1', number: 34, name: 'Ali Khan', university: null, dueDate: '2026-10-28', note: 'Call about <IELTS>' },
    { kind: 'application', id: 'a1', number: 12, name: 'Sara Ahmed', university: 'University of Leeds', dueDate: '2026-10-25', note: null },
  ];
  const base = { items, todayKey: '2026-10-28', orgName: 'IEN', appUrl: 'https://crm.example.com' };

  it('morning summary lists today and overdue with links', () => {
    const e = buildReminderEmail({ ...base, slot: 'morning' });
    expect(e.subject).toBe('2 follow-ups due today — IEN');
    expect(e.html).toContain('Due today (1)');
    expect(e.html).toContain('Overdue (1)');
    expect(e.html).toContain('https://crm.example.com/leads/l1');
    expect(e.html).toContain('https://crm.example.com/applications/a1');
    expect(e.html).toContain('3 days overdue');
    expect(e.body).toBe('1 due today · 1 overdue');
  });

  it('escapes staff-entered text', () => {
    const e = buildReminderEmail({ ...base, slot: 'morning' });
    expect(e.html).toContain('Call about &lt;IELTS&gt;');
    expect(e.html).not.toContain('<IELTS>');
  });

  it('afternoon reminder says what is still open', () => {
    const e = buildReminderEmail({ ...base, items: [items[0]!], slot: 'afternoon' });
    expect(e.subject).toBe('Still open: 1 follow-up needs attention today — IEN');
    expect(e.title).toBe('1 follow-up still open today');
  });
});
