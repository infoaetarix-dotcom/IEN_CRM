import { test, expect, type Browser, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';
import { TEST_USERS, TEST_PASSWORD, STATE_FILE, submitLogin, serviceClient, loadEnv } from './helpers';

function state() {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as { org: string; users: Record<string, string> };
}

// On Vercel the platform sets x-real-ip; here the agent's browser sends it,
// standing in for "this laptop is on this network".
const AGENT_IP = '203.0.113.50';

async function loginAs(browser: Browser, email: string, landing = /\/dashboard/, headers?: Record<string, string>) {
  const ctx = await browser.newContext({ extraHTTPHeaders: headers });
  const page = await ctx.newPage();
  await submitLogin(page, email, TEST_PASSWORD);
  await page.waitForURL(landing, { timeout: 60000 });
  return page;
}

async function asUser(email: string) {
  const env = loadEnv();
  const c = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  return c;
}

const clockInBtn = (p: Page) => p.getByRole('button', { name: 'Clock in', exact: true });
const clockOutBtn = (p: Page) => p.getByRole('button', { name: 'Clock out', exact: true });

async function sessionsOf(profileId: string) {
  const { data } = await serviceClient()
    .from('attendance_sessions')
    .select('*')
    .eq('profile_id', profileId)
    .order('clock_in_at', { ascending: true });
  return data ?? [];
}

test.describe.serial('attendance', () => {
  let agent: Page;
  let superPage: Page;
  let superId = '';

  test.beforeAll(async () => {
    const svc = serviceClient();
    const { org } = state();
    await svc.from('attendance_sessions').delete().eq('organization_id', org);
    await svc.from('attendance_office_networks').delete().eq('organization_id', org);
  });

  test.afterAll(async () => {
    const svc = serviceClient();
    const { org } = state();
    await svc.from('attendance_sessions').delete().eq('organization_id', org);
    await svc.from('attendance_office_networks').delete().eq('organization_id', org);
    await svc.from('organization_modules').update({ enabled: true }).eq('organization_id', org).eq('module_key', 'attendance');
    if (superId) {
      await svc.from('audit_log').delete().eq('actor_id', superId);
      await svc.from('profiles').delete().eq('id', superId);
      await svc.auth.admin.deleteUser(superId).catch(() => {});
    }
  });

  test('agent clocks in and out from the top bar — remote until an office IP is set', async ({ browser }) => {
    test.setTimeout(120000);
    const { users } = state();
    agent = await loginAs(browser, TEST_USERS.agentA.email, /\/dashboard/, { 'x-real-ip': AGENT_IP });

    await clockInBtn(agent).click();
    await expect(clockOutBtn(agent)).toBeVisible({ timeout: 15000 });
    const timer = agent.getByRole('timer');
    await expect(timer).toHaveAccessibleName(/Clocked in from remote/);
    await expect(timer).toContainText('Remote');
    // The clock runs.
    const first = await timer.textContent();
    await expect.poll(async () => timer.textContent(), { timeout: 5000 }).not.toBe(first);

    await clockOutBtn(agent).click();
    await expect(clockInBtn(agent)).toBeVisible({ timeout: 15000 });

    const [s] = await sessionsOf(users.agentA);
    expect(s).toMatchObject({
      clock_in_ip: AGENT_IP,
      clock_in_place: 'remote',
      clock_out_place: 'remote',
      clock_out_method: 'manual',
    });
    expect(Date.parse(s.clock_out_at)).toBeGreaterThan(Date.parse(s.clock_in_at));
  });

  test('super admin finds the office IP among recent clock-ins and marks it', async ({ browser }) => {
    test.setTimeout(120000);
    const svc = serviceClient();
    const { org } = state();
    const email = `e2e_super_att_${Date.now()}@ientest.local`;
    const { data: created } = await svc.auth.admin.createUser({ email, password: TEST_PASSWORD, email_confirm: true });
    superId = created.user!.id;
    await svc.from('profiles').update({ role: 'admin', full_name: 'E2E Super Att', is_super_admin: true, organization_id: null }).eq('id', superId);

    superPage = await loginAs(browser, email, /\/super/);
    await superPage.goto(`/super/orgs/${org}`);
    await expect(superPage.getByText('None yet — every clock-in counts as Remote.')).toBeVisible();
    const recent = superPage.getByRole('table', { name: 'Recent clock-in IPs' });
    const row = recent.getByRole('row').filter({ hasText: AGENT_IP });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Mark as office' }).click();
    await expect(superPage.getByRole('list', { name: 'Office IPs' }).getByText(AGENT_IP)).toBeVisible({ timeout: 15000 });
    await expect(row.getByText('Office', { exact: true })).toBeVisible();

    // Typed entries are checked and normalised.
    await superPage.getByLabel('Add office IP').fill('not an ip');
    await superPage.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(superPage.getByText(/doesn’t look like an IP address/)).toBeVisible();
    await superPage.getByLabel('Add office IP').fill('2400:adc1:1:2:aaaa:bbbb:cccc:dddd');
    await superPage.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(superPage.getByRole('list', { name: 'Office IPs' }).getByText('2400:adc1:1:2::/64')).toBeVisible({ timeout: 15000 });
    await superPage.getByRole('button', { name: 'Remove 2400:adc1:1:2::/64' }).click();
    await expect(superPage.getByText('2400:adc1:1:2::/64')).toHaveCount(0, { timeout: 15000 });
  });

  test('from the office network it records Office; pings keep the session alive', async () => {
    test.setTimeout(60000);
    const { users } = state();
    await clockInBtn(agent).click();
    await expect(agent.getByRole('timer')).toHaveAccessibleName(/Clocked in from office/, { timeout: 15000 });
    await expect(agent.getByRole('timer')).toContainText('Office');

    const open = (await sessionsOf(users.agentA)).find((s) => !s.clock_out_at)!;
    expect(open.clock_in_place).toBe('office');
    const res = await agent.request.post('/api/attendance/ping', { headers: { 'x-real-ip': AGENT_IP } });
    expect(res.ok()).toBe(true);
    expect((await res.json()).state.open.place).toBe('office');
    const after = (await sessionsOf(users.agentA)).find((s) => s.id === open.id)!;
    expect(Date.parse(after.last_seen_at)).toBeGreaterThanOrEqual(Date.parse(open.last_seen_at));
    expect(after.clock_out_at).toBeNull();
  });

  test('the background worker pings by itself every 2 minutes while the CRM is open', async () => {
    test.setTimeout(240000);
    const svc = serviceClient();
    const { users } = state();
    const open = (await sessionsOf(users.agentA)).find((s) => !s.clock_out_at)!;
    // Mark the last ping 1 minute old; only the worker's own beat can move it.
    const marker = new Date(Date.now() - 60_000).toISOString();
    await svc.from('attendance_sessions').update({ last_seen_at: marker }).eq('id', open.id);
    await expect
      .poll(
        async () => {
          const s = (await sessionsOf(users.agentA)).find((x) => x.id === open.id)!;
          return Date.parse(s.last_seen_at) > Date.parse(marker) + 30_000;
        },
        { timeout: 170000, intervals: [5000] },
      )
      .toBe(true);
    const s = (await sessionsOf(users.agentA)).find((x) => x.id === open.id)!;
    expect(s.clock_out_at).toBeNull();
    expect(s.last_seen_place).toBe('office');
  });

  test('CRM closed: after 5 minutes without a ping it clocks out at the last ping', async () => {
    test.setTimeout(60000);
    const svc = serviceClient();
    const { users } = state();
    const all = await sessionsOf(users.agentA);
    const earlier = all.find((s) => s.clock_out_at)!;
    const open = all.find((s) => !s.clock_out_at)!;
    // A realistic day: 1h–50m ago a remote session, then from 40m ago in
    // the office until the laptop shut down 10 minutes ago.
    const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
    const lastPing = ago(10);
    await svc.from('attendance_sessions').update({ clock_in_at: ago(60), clock_out_at: ago(50) }).eq('id', earlier.id);
    await svc.from('attendance_sessions').update({ clock_in_at: ago(40), last_seen_at: lastPing }).eq('id', open.id);

    // Opening the CRM again: it's already closed, at the last ping.
    await agent.reload();
    await expect(clockInBtn(agent)).toBeVisible({ timeout: 15000 });
    await expect(agent.getByRole('status').filter({ hasText: /Auto clocked out at/ })).toBeVisible();
    const closed = (await sessionsOf(users.agentA)).find((s) => s.id === open.id)!;
    expect(closed.clock_out_method).toBe('auto');
    expect(closed.clock_out_place).toBe('office');
    expect(Math.abs(Date.parse(closed.clock_out_at) - Date.parse(lastPing))).toBeLessThan(1000);

    // Dismissed, it stays dismissed.
    await agent.getByRole('button', { name: 'Dismiss' }).click();
    await agent.reload();
    await expect(clockInBtn(agent)).toBeVisible({ timeout: 15000 });
    await expect(agent.getByText(/Auto clocked out at/)).toHaveCount(0);

    // A session never runs past its day's midnight, even if still pinging.
    const { data: lateRow } = await svc
      .from('attendance_sessions')
      .insert({
        organization_id: state().org,
        profile_id: users.agentB,
        work_date: '2026-01-05',
        day_ends_at: '2026-01-05T19:00:00Z',
        clock_in_at: '2026-01-05T15:00:00Z',
        clock_in_place: 'remote',
        last_seen_at: new Date().toISOString(),
        last_seen_place: 'remote',
      })
      .select('id')
      .single();
    await svc.rpc('attendance_close_stale', { stale_seconds: 300, only_profile: users.agentB });
    const { data: capped } = await svc.from('attendance_sessions').select('clock_out_at, clock_out_method').eq('id', lateRow!.id).single();
    expect(capped).toMatchObject({ clock_out_method: 'auto' });
    expect(new Date(capped!.clock_out_at).toISOString()).toBe('2026-01-05T19:00:00.000Z');
    await svc.from('attendance_sessions').delete().eq('id', lateRow!.id);
  });

  test('admin sees every agent’s record and exports it; admins don’t clock in', async ({ browser }) => {
    test.setTimeout(120000);
    const admin = await loginAs(browser, TEST_USERS.admin.email);
    await expect(clockInBtn(admin)).toHaveCount(0);
    await admin.getByRole('link', { name: 'Attendance' }).first().click();
    await admin.waitForURL(/\/attendance/);

    const todayCard = admin.getByRole('list', { name: 'Today' }).getByRole('listitem').filter({ hasText: 'E2E Agent A' });
    await expect(todayCard).toBeVisible();
    await expect(todayCard.getByText('Office').first()).toBeVisible();
    await expect(todayCard.getByText('Remote').first()).toBeVisible();
    await expect(todayCard.getByText('Auto', { exact: true })).toBeVisible();

    const historyRow = admin.locator('tbody tr').filter({ hasText: 'E2E Agent A' }).first();
    await expect(historyRow).toBeVisible();
    await expect(historyRow).toContainText(/Present|Weekend work/);

    // Only Agent A's rows when filtered to Agent A.
    await admin.getByLabel('Agent', { exact: true }).selectOption({ label: 'E2E Agent A' });
    await expect(admin.locator('tbody tr').filter({ hasText: 'E2E Agent B' })).toHaveCount(0, { timeout: 15000 });

    await admin.getByRole('button', { name: /^export$/i }).click();
    const dialog = admin.getByRole('dialog');
    await dialog.getByRole('button', { name: 'This month' }).click();
    const [file] = await Promise.all([admin.waitForEvent('download'), dialog.getByRole('link', { name: /download excel/i }).click()]);
    expect(file.suggestedFilename()).toMatch(/^attendance-\d{4}-\d{2}-01-to-\d{4}-\d{2}-\d{2}\.xlsx$/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(await file.path());
    const sheet = wb.getWorksheet('Attendance')!;
    const header = (sheet.getRow(1).values as string[]).filter(Boolean);
    expect(header).toEqual(['Date', 'Day', 'Agent', 'Status', 'Clock In', 'Clock In From', 'Clock Out', 'Clock Out From', 'Clocked Out By', 'Session Hours', 'Day Total']);
    const rows: Record<string, unknown>[] = [];
    sheet.eachRow((row, i) => {
      if (i > 1) rows.push(Object.fromEntries(header.map((h, c) => [h, row.getCell(c + 1).value])));
    });
    const mine = rows.filter((r) => r.Agent === 'E2E Agent A');
    expect(mine.map((r) => [r['Clock In From'], r['Clocked Out By']])).toEqual(
      expect.arrayContaining([
        ['Remote', 'Agent'],
        ['Office', 'Auto (CRM closed)'],
      ]),
    );
    await admin.context().close();
  });

  test('agents can’t open the report, read others’ records, or write their own times', async () => {
    test.setTimeout(60000);
    const { org, users } = state();
    await expect(agent.getByRole('link', { name: 'Attendance' })).toHaveCount(0);
    await agent.goto('/attendance');
    await agent.waitForURL(/\/dashboard/);

    const asA = await asUser(TEST_USERS.agentA.email);
    const { data: own } = await asA.from('attendance_sessions').select('id');
    expect((own ?? []).length).toBeGreaterThan(0);
    const { error: forged } = await asA.from('attendance_sessions').insert({
      organization_id: org,
      profile_id: users.agentA,
      work_date: '2026-01-05',
      day_ends_at: '2026-01-05T19:00:00Z',
      clock_in_place: 'office',
      last_seen_place: 'office',
    });
    expect(forged).not.toBeNull();
    const { data: edited } = await asA.from('attendance_sessions').update({ clock_in_place: 'office' }).eq('profile_id', users.agentA).select('id');
    expect(edited ?? []).toHaveLength(0);
    const { data: nets } = await asA.from('attendance_office_networks').select('id');
    expect(nets ?? []).toHaveLength(0);
    const { error: rpcErr } = await asA.rpc('attendance_close_stale', { stale_seconds: 0, only_profile: null });
    expect(rpcErr).not.toBeNull();

    const asB = await asUser(TEST_USERS.agentB.email);
    const { data: peek } = await asB.from('attendance_sessions').select('id').eq('profile_id', users.agentA);
    expect(peek ?? []).toHaveLength(0);
  });

  test('module off: no clock, no page, no records; super admin can remove the office IP', async () => {
    test.setTimeout(60000);
    const svc = serviceClient();
    const { org } = state();
    await svc.from('organization_modules').update({ enabled: false }).eq('organization_id', org).eq('module_key', 'attendance');
    try {
      await agent.goto('/dashboard');
      await expect(agent.getByText(/welcome back/i)).toBeVisible({ timeout: 30000 });
      await expect(clockInBtn(agent)).toHaveCount(0);
      const res = await agent.request.post('/api/attendance/ping');
      expect(res.status()).toBe(403);
      const asA = await asUser(TEST_USERS.agentA.email);
      const { data: hidden } = await asA.from('attendance_sessions').select('id');
      expect(hidden ?? []).toHaveLength(0);
    } finally {
      await svc.from('organization_modules').update({ enabled: true }).eq('organization_id', org).eq('module_key', 'attendance');
    }

    await superPage.goto(`/super/orgs/${org}`);
    await superPage.getByRole('button', { name: `Remove ${AGENT_IP}` }).click();
    await expect(superPage.getByText('None yet — every clock-in counts as Remote.')).toBeVisible({ timeout: 15000 });
    await agent.context().close();
    await superPage.context().close();
  });
});
