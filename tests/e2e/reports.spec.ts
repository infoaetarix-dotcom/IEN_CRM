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

test('application intake report counts the funnel and opens matching applications', async ({ page }) => {
  test.setTimeout(120000);
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
      { ...base, status: 'conditional_offer', intake_season: 'fall', intake_year: 2030 },
      { ...base, status: 'visa_accepted', intake_season: 'fall', intake_year: 2030 },
      { ...base, status: 'visa_rejected', intake_season: 'fall', intake_year: 2030 },
      { ...base, status: 'applied_processed' }, // no intake
    ])
    .select('id');
  if (error) throw new Error(error.message);

  try {
    await login(page);
    await page.goto('/settings/reports?type=intake&season=fall&year=2030');
    await expect(page.getByRole('heading', { name: 'Fall 2030 intake' })).toBeVisible();

    // Stat cards come before the per-status rows of the same name.
    const card = (name: RegExp) => page.getByRole('link', { name }).first();
    await expect(card(/applications generated/i)).toContainText('3');
    await expect(card(/visa applied/i)).toContainText('2');
    await expect(card(/^visa accepted/i)).toContainText('1');
    await expect(page.getByText('50%')).toBeVisible(); // 1 accepted of 2 decided
    await expect(page.getByText(/no intake set/i)).toBeVisible();

    await card(/^visa accepted/i).click();
    await page.waitForURL(/\/applications\?/);
    await expect(page.getByText(/showing\s+1\s+from the report/i)).toBeVisible();
    await expect(page.getByText('Fall 2030 intake · Visa accepted')).toBeVisible();
  } finally {
    await svc.from('applications').delete().in('id', (apps ?? []).map((a) => a.id));
    await svc.from('universities').delete().eq('id', uni!.id);
  }
});

test('admin sets up reporting periods; the period report follows them', async ({ page }) => {
  test.setTimeout(150000);
  const svc = serviceClient();
  const { org } = state() as { org: string };

  try {
    await login(page);
    await page.goto('/settings');
    await page.getByRole('button', { name: /reporting periods/i }).click();
    const dialog = page.getByRole('dialog');

    await dialog.getByRole('button', { name: /start with common intakes/i }).click();
    await expect(dialog.getByText('Sep–Oct intake')).toBeVisible({ timeout: 30000 });
    await expect(dialog.getByText('Jan–Feb intake')).toBeVisible();
    await expect(dialog.getByText(/leads received september – october · reported in november/i)).toBeVisible();

    // A period overlapping an existing one is refused.
    await dialog.getByRole('button', { name: /add period/i }).click();
    await dialog.getByLabel('Name').fill('Overlap test');
    await dialog.getByLabel('Leads from').selectOption('2');
    await dialog.getByLabel('Leads to').selectOption('3');
    await dialog.getByLabel('Report in').selectOption('4');
    await dialog.getByRole('button', { name: /^add period$/i }).click();
    await expect(dialog.getByText(/overlap “Jan–Feb intake”/i)).toBeVisible({ timeout: 30000 });
    await page.keyboard.press('Escape');

    const { data: periods } = await svc.from('reporting_periods').select('id, name').eq('organization_id', org);
    expect(periods?.map((p) => p.name).sort()).toEqual(['Apr–May intake', 'Jan–Feb intake', 'Sep–Oct intake']);
    const sepOct = periods!.find((p) => p.name === 'Sep–Oct intake')!;

    // Sep–Oct 2030 hasn't reached its report month: in progress.
    await page.goto(`/settings/reports?type=period&period=${sepOct.id}&year=2030`);
    await expect(page.getByRole('heading', { name: 'Sep–Oct intake 2030' })).toBeVisible();
    await expect(page.getByText(/in progress · final from 1 november 2030/i)).toBeVisible();
    await expect(page.getByText('Leads per month')).toBeVisible();

    // Sep–Oct 2025 is long past November 2025: final.
    await page.goto(`/settings/reports?type=period&period=${sepOct.id}&year=2025`);
    await expect(page.getByText('Final', { exact: true })).toBeVisible();
  } finally {
    await svc.from('reporting_periods').delete().eq('organization_id', org);
  }
});

test('agents can see reporting periods but not change them', async ({ page }) => {
  test.setTimeout(120000);
  const svc = serviceClient();
  const { org } = state() as { org: string };
  await svc.from('reporting_periods').insert({
    organization_id: org,
    name: 'Agent view period',
    start_month: 9,
    end_month: 10,
    report_month: 11,
  });

  try {
    await submitLogin(page, TEST_USERS.agentA.email, TEST_PASSWORD);
    await page.waitForURL(/\/dashboard/, { timeout: 60000 });
    await page.goto('/settings');
    await page.getByRole('button', { name: /reporting periods/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Agent view period')).toBeVisible();
    await expect(dialog.getByText(/only admins can change these/i)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /add period/i })).toHaveCount(0);
    await expect(dialog.getByTitle('Edit')).toHaveCount(0);
    await expect(dialog.getByLabel('Time zone')).toBeDisabled();

    // RLS backs the hidden buttons up: a direct write as the agent is rejected.
    const env = loadEnv();
    const asAgent = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    await asAgent.auth.signInWithPassword({ email: TEST_USERS.agentA.email, password: TEST_PASSWORD });
    const { data: inserted } = await asAgent
      .from('reporting_periods')
      .insert({ organization_id: org, name: 'Agent write', start_month: 1, end_month: 1, report_month: 2 })
      .select('id');
    expect(inserted ?? []).toHaveLength(0);
    const { data: seen } = await asAgent.from('reporting_periods').select('name');
    expect(seen?.map((p) => p.name)).toEqual(['Agent view period']);

    // Reports themselves stay visible to agents.
    await page.goto('/settings/reports?type=monthly');
    await expect(page.getByRole('link', { name: /leads received/i })).toBeVisible();
  } finally {
    await svc.from('reporting_periods').delete().eq('organization_id', org);
  }
});
