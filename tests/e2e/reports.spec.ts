import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { TEST_USERS, TEST_PASSWORD, STATE_FILE, submitLogin, serviceClient, loadEnv } from './helpers';

function state() {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

async function login(page: Page) {
  await submitLogin(page, TEST_USERS.admin.email, TEST_PASSWORD);
  await page.waitForURL(/\/dashboard/, { timeout: 60000 });
}

/** Today's date in the default reporting zone (Asia/Karachi), as YYYY-MM-DD. */
function todayKarachi() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
}

test('dashboard cards and charts open the filtered leads list', async ({ page }) => {
  test.setTimeout(120000);
  const today = todayKarachi();
  await login(page);

  await page.getByRole('link', { name: /leads this month/i }).click();
  await page.waitForURL(/\/leads\?/);
  const url = new URL(page.url());
  expect(url.searchParams.get('from')).toBe(`${today.slice(0, 7)}-01`);
  expect(url.searchParams.get('to')).toBe(today);
  // The filter bar shows why the list is narrowed, and can clear it.
  await expect(page.getByLabel('Received from')).toHaveValue(`${today.slice(0, 7)}-01`);
  await expect(page.getByText('E2E Lead A')).toBeVisible();
  await expect(page.getByRole('link', { name: /clear filters/i })).toBeVisible();

  await page.goto('/dashboard');
  await page.getByRole('link', { name: /new today/i }).click();
  await page.waitForURL(/status=raw_lead/);
  await expect(page.getByLabel('Status')).toHaveValue('raw_lead');

  // A bar in "Leads by source" opens that source.
  await page.goto('/dashboard');
  const sourceCard = page.locator('div.rounded-xl', { has: page.getByText('Leads by source', { exact: true }) });
  await sourceCard.locator('.recharts-bar-rectangle').first().click();
  await page.waitForURL(/\/leads\?source=/);
  expect(new URL(page.url()).searchParams.get('source')).toBeTruthy();
});

test('monthly lead report opens from Settings and links to its leads', async ({ page }) => {
  test.setTimeout(120000);
  const today = todayKarachi();
  await login(page);

  await page.goto('/settings');
  await page.getByRole('link', { name: /^reports/i }).click();
  await page.waitForURL(/\/settings\/reports/);

  await page.getByLabel('Month').fill(today.slice(0, 7));
  await page.waitForURL(new RegExp(`month=${today.slice(0, 7)}`));
  // The exact count for this month, straight from the database — not just
  // "some digit", which the comparison line ("0 in September 2026") also has.
  const { org } = state() as { org: string };
  const nextMonth = new Date(`${today.slice(0, 7)}-01T00:00:00+05:00`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const { count } = await serviceClient()
    .from('leads')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', org)
    .is('archived_at', null)
    .gte('created_at', new Date(`${today.slice(0, 7)}-01T00:00:00+05:00`).toISOString())
    .lt('created_at', nextMonth.toISOString());
  expect(count).toBeGreaterThan(0);
  const received = page.getByRole('link', { name: /leads received/i });
  await expect(received.locator('p').nth(1)).toHaveText(String(count));
  await expect(page.getByText('By staff member')).toBeVisible();

  await received.click();
  await page.waitForURL(/\/leads\?/);
  await expect(page.getByText('E2E Lead A')).toBeVisible();
});

test('intake report: leads aiming for the intake, plus the applications funnel, each opening its list', async ({
  page,
}) => {
  test.setTimeout(150000);
  const svc = serviceClient();
  const { org, leadA } = state() as { org: string; leadA: string };

  const { data: uni } = await svc
    .from('universities')
    .insert({ organization_id: org, name: 'E2E Report Uni', country: 'Canada' })
    .select('id')
    .single();
  const base = { lead_id: leadA, organization_id: org, full_name: 'E2E Lead A', university_id: uni!.id };
  const { data: apps, error } = await svc
    .from('applications')
    .insert([
      { ...base, status: 'conditional_offer', intake_season: 'sep_oct', intake_year: 2030 },
      { ...base, status: 'visa_accepted', intake_season: 'sep_oct', intake_year: 2030 },
      { ...base, status: 'visa_rejected', intake_season: 'sep_oct', intake_year: 2030 },
      { ...base, status: 'applied_processed' }, // no intake
    ])
    .select('id');
  if (error) throw new Error(error.message);
  // Lead A is aiming for Sep–Oct 2030; Lead B has no intake.
  await svc.from('leads').update({ intake_season: 'sep_oct', intake_year: 2030 }).eq('id', leadA);

  try {
    await login(page);
    await page.goto('/settings/reports?type=intake&season=sep_oct&year=2030');
    await expect(page.getByRole('heading', { name: 'Sep – Oct 2030 intake' })).toBeVisible();
    await expect(page.getByText(/in progress · final from 1 november 2030/i)).toBeVisible();

    // Leads half.
    const leadsCard = page.getByRole('link', { name: /leads for this intake/i });
    await expect(leadsCard.locator('p').nth(1)).toHaveText('1');
    await expect(page.getByText(/leads? (has|have) no intake set/i)).toBeVisible();

    // Applications half. Stat cards come before per-status rows of the same name.
    const card = (name: RegExp) => page.getByRole('link', { name }).first();
    await expect(card(/applications generated/i)).toContainText('3');
    await expect(card(/visa applied/i)).toContainText('2');
    await expect(card(/^visa accepted/i)).toContainText('1');
    await expect(page.getByText('50%')).toBeVisible(); // 1 accepted of 2 decided
    await expect(page.getByText(/application has no intake set/i)).toBeVisible();

    // A lead number opens the leads list filtered to that intake.
    await leadsCard.click();
    await page.waitForURL(/\/leads\?/);
    await expect(page.getByLabel('Intake', { exact: true })).toHaveValue('sep_oct');
    await expect(page.getByText('E2E Lead A')).toBeVisible();
    await expect(page.getByText('E2E Lead B')).toHaveCount(0);

    // An application number opens the applications list with the bar pre-filled.
    await page.goBack();
    await card(/^visa accepted/i).click();
    await page.waitForURL(/\/applications\?/);
    await expect(page.getByText(/showing\s+1\s+from the report/i)).toBeVisible();
    await expect(page.getByText('Sep – Oct 2030 intake · Visa accepted')).toBeVisible();
    await expect(page.getByLabel('Intake', { exact: true })).toHaveValue('sep_oct');
    await expect(page.getByLabel('Intake year')).toHaveValue('2030');
  } finally {
    await svc.from('leads').update({ intake_season: null, intake_year: null }).eq('id', leadA);
    await svc.from('applications').delete().in('id', (apps ?? []).map((a) => a.id));
    await svc.from('universities').delete().eq('id', uni!.id);
  }
});

test('agents can see the time zone but not change it', async ({ page }) => {
  test.setTimeout(120000);
  const { org } = state() as { org: string };

  await submitLogin(page, TEST_USERS.agentA.email, TEST_PASSWORD);
  await page.waitForURL(/\/dashboard/, { timeout: 60000 });
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: /reporting periods/i })).toHaveCount(0);
  await page.getByRole('button', { name: /time zone/i }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/only admins can change it/i)).toBeVisible();
  await expect(dialog.getByLabel('Time zone')).toBeDisabled();
  await expect(dialog.getByRole('button', { name: /^save$/i })).toHaveCount(0);

  // RLS backs the hidden button up: a direct write as the agent is rejected.
  const env = loadEnv();
  const asAgent = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  await asAgent.auth.signInWithPassword({ email: TEST_USERS.agentA.email, password: TEST_PASSWORD });
  const { data: written } = await asAgent
    .from('reporting_settings')
    .upsert({ organization_id: org, timezone: 'Europe/London' })
    .select('timezone');
  expect(written ?? []).toHaveLength(0);

  // Reports themselves stay visible to agents.
  await page.goto('/settings/reports?type=monthly');
  await expect(page.getByRole('link', { name: /leads received/i })).toBeVisible();
});
