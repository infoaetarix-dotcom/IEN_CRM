import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { TEST_USERS, TEST_PASSWORD, STATE_FILE, submitLogin, serviceClient } from './helpers';

function state() {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

async function login(page: Page) {
  await submitLogin(page, TEST_USERS.admin.email, TEST_PASSWORD);
  await page.waitForURL(/\/dashboard/, { timeout: 60000 });
}

/** Today in the default reporting zone (Asia/Karachi), YYYY-MM-DD. */
function todayKarachi(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(d);
}

test('set a follow-up on a lead, see it in the table, mark it done and set the next', async ({ page }) => {
  test.setTimeout(150000);
  const svc = serviceClient();
  const { leadA } = state() as { leadA: string };

  try {
    await login(page);
    await page.goto('/leads');
    const rowA = page.getByRole('row', { name: /E2E Lead A/ });
    await rowA.getByRole('button', { name: 'Set follow-up' }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Today', exact: true }).click();
    await dialog.getByLabel('Note (optional)').fill('Call about IELTS result');
    await dialog.getByRole('button', { name: /^set follow-up$/i }).click();
    await expect(dialog).toBeHidden({ timeout: 30000 });

    // Tag on the row, and the filter finds it (and only it).
    await expect(rowA.getByText('Follow-up today')).toBeVisible();
    await page.goto('/leads?followup=today');
    await expect(page.getByText('E2E Lead A')).toBeVisible();
    await expect(page.getByText('E2E Lead B')).toHaveCount(0);
    await expect(page.getByLabel('Follow-up', { exact: true })).toHaveValue('today');

    // Dashboard strip counts it.
    await page.goto('/dashboard');
    await expect(page.getByText(/1 follow-up\s*due today/)).toBeVisible();

    // Mark done → set the next one in the same step (defaults to +3 days).
    await page.goto('/leads');
    await page.getByRole('row', { name: /E2E Lead A/ }).getByRole('button', { name: 'Follow-up today' }).click();
    await dialog.getByRole('button', { name: /mark done/i }).click();
    await expect(dialog.getByText('Set the next follow-up?')).toBeVisible();
    await dialog.getByRole('button', { name: /done \+ set next/i }).click();
    await expect(dialog).toBeHidden({ timeout: 30000 });

    const { data: rows } = await svc
      .from('follow_ups')
      .select('due_date, note, completed_at, completed_by')
      .eq('lead_id', leadA)
      .order('created_at');
    expect(rows).toHaveLength(2);
    expect(rows![0]).toMatchObject({ due_date: todayKarachi(), note: 'Call about IELTS result' });
    expect(rows![0]!.completed_at).not.toBeNull();
    expect(rows![1]).toMatchObject({ due_date: todayKarachi(3), completed_at: null });

    // Detail page: open follow-up + done history with who completed it.
    await page.goto(`/leads/${leadA}`);
    await expect(page.getByText(/done by E2E Admin/)).toBeVisible();
    await expect(page.getByRole('button', { name: /change follow-up/i })).toBeVisible();
  } finally {
    await svc.from('follow_ups').delete().eq('lead_id', leadA);
  }
});

test('follow-up on an application: set from the table, then remove', async ({ page }) => {
  test.setTimeout(150000);
  const svc = serviceClient();
  const { org, leadA } = state() as { org: string; leadA: string };
  const { data: uni } = await svc
    .from('universities')
    .insert({ organization_id: org, name: 'E2E Follow-up Uni', country: 'Ireland' })
    .select('id')
    .single();
  const { data: app } = await svc
    .from('applications')
    .insert({ lead_id: leadA, organization_id: org, full_name: 'E2E Follow-up App', university_id: uni!.id })
    .select('id')
    .single();

  try {
    await login(page);
    await page.goto('/applications');
    const row = page.getByRole('row', { name: /E2E Follow-up App/ });
    await row.getByRole('button', { name: 'Set follow-up' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'In 1 week' }).click();
    await dialog.getByRole('button', { name: /^set follow-up$/i }).click();
    await expect(dialog).toBeHidden({ timeout: 30000 });
    await expect(row.getByText(/^Follow-up \w{3} \d{1,2} \w{3}$/)).toBeVisible();

    await page.goto('/applications?followup=week');
    await expect(page.getByText('E2E Follow-up App')).toBeVisible();

    page.once('dialog', (d) => d.accept()); // the "Remove this follow-up?" confirm
    await page.getByRole('row', { name: /E2E Follow-up App/ }).getByRole('button', { name: /^Follow-up / }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByRole('dialog')).toBeHidden({ timeout: 30000 });
    const { count } = await svc
      .from('follow_ups')
      .select('id', { count: 'exact', head: true })
      .eq('application_id', app!.id);
    expect(count).toBe(0);
  } finally {
    await svc.from('follow_ups').delete().eq('application_id', app!.id);
    await svc.from('applications').delete().eq('id', app!.id);
    await svc.from('universities').delete().eq('id', uni!.id);
  }
});

test('reminder cron: secret required, emails due + overdue once per slot', async ({ request }) => {
  test.setTimeout(120000);
  const secret = process.env.CRON_SECRET;
  test.skip(!secret, 'CRON_SECRET must be set for the test server');
  const svc = serviceClient();
  const { org, leadA, leadB } = state() as { org: string; leadA: string; leadB: string };

  // The cron covers every org. Never run it while a real org has
  // follow-ups due, so this test can't remind a real team.
  const { count: others } = await svc
    .from('follow_ups')
    .select('id', { count: 'exact', head: true })
    .neq('organization_id', org)
    .is('completed_at', null)
    .lte('due_date', todayKarachi(1));
  test.skip(!!others, 'Another organization has follow-ups due — not running the cron against it.');

  await svc.from('follow_ups').insert([
    { organization_id: org, lead_id: leadA, due_date: todayKarachi(), note: 'Due today' },
    { organization_id: org, lead_id: leadB, due_date: todayKarachi(-2), note: 'Two days late' },
  ]);
  const since = new Date().toISOString();

  try {
    expect((await request.get('/api/cron/follow-up-reminders/morning')).status()).toBe(401);
    expect(
      (await request.get('/api/cron/follow-up-reminders/morning', { headers: { authorization: 'Bearer wrong' } })).status(),
    ).toBe(401);

    const auth = { headers: { authorization: `Bearer ${secret}` } };
    const first = await (await request.get('/api/cron/follow-up-reminders/morning', auth)).json();
    expect(first.ok).toBe(true);
    expect(first.results.find((r: { organizationId: string }) => r.organizationId === org)).toMatchObject({
      sent: true,
      followUps: 2,
    });

    // Every active staff member got a bell notification.
    const { data: notes } = await svc
      .from('notifications')
      .select('profile_id, title')
      .eq('organization_id', org)
      .eq('type', 'follow_up_due')
      .gte('created_at', since);
    const { count: staff } = await svc
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org)
      .eq('is_active', true);
    expect(notes).toHaveLength(staff!);
    expect(notes![0]!.title).toBe('2 follow-ups due today');

    // A second morning run the same day sends nothing more.
    const again = await (await request.get('/api/cron/follow-up-reminders/morning', auth)).json();
    expect(again.results.find((r: { organizationId: string }) => r.organizationId === org)).toMatchObject({
      sent: false,
      reason: 'already sent',
    });

    // The afternoon slot is separate and only counts what's still open.
    await svc.from('follow_ups').update({ completed_at: new Date().toISOString() }).eq('lead_id', leadA);
    const pm = await (await request.get('/api/cron/follow-up-reminders/afternoon', auth)).json();
    expect(pm.results.find((r: { organizationId: string }) => r.organizationId === org)).toMatchObject({
      sent: true,
      followUps: 1,
    });
  } finally {
    await svc.from('follow_ups').delete().eq('organization_id', org);
    await svc.from('follow_up_reminder_runs').delete().eq('organization_id', org);
    await svc.from('notifications').delete().eq('organization_id', org).eq('type', 'follow_up_due');
  }
});
