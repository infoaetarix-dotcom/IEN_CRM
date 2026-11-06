import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { TEST_USERS, TEST_PASSWORD, STATE_FILE, submitLogin, serviceClient } from './helpers';

function state() {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as { org: string; leadA: string };
}

async function login(page: Page) {
  await submitLogin(page, TEST_USERS.admin.email, TEST_PASSWORD);
  await page.waitForURL(/\/dashboard/, { timeout: 60000 });
}

const noSideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

test('phone: leads and applications filters fold into a tidy panel, no sideways scrolling', async ({ browser }) => {
  test.setTimeout(150000);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await login(page);

  for (const path of ['/leads', '/applications']) {
    await page.goto(path);
    const toggle = page.getByRole('button', { name: /^filters/i });
    await expect(toggle).toBeVisible();
    // Filters start folded away; only search + the button show.
    await expect(page.getByLabel('Status')).toBeHidden();
    expect(await noSideScroll(page)).toBe(true);

    await toggle.click();
    await expect(page.getByLabel('Status')).toBeVisible();
    expect(await noSideScroll(page)).toBe(true);
    // Two equal columns: the intake and year boxes are the same width.
    const intake = await page.getByLabel('Intake', { exact: true }).boundingBox();
    const year = await page.getByLabel('Intake year').boundingBox();
    expect(Math.abs(intake!.width - year!.width)).toBeLessThan(2);

    // The button counts active filters.
    await page.getByLabel('Intake', { exact: true }).selectOption('sep_oct');
    await expect(page.getByRole('button', { name: 'Filters (1)' })).toBeVisible({ timeout: 15000 });
  }

  // Desktop is unchanged: no Filters button, filters inline.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/leads');
  await expect(page.getByRole('button', { name: /^filters/i })).toBeHidden();
  await expect(page.getByLabel('Status')).toBeVisible();
  await ctx.close();
});

test('applications export: by created date, Excel and CSV, every field', async ({ page }) => {
  test.setTimeout(150000);
  const svc = serviceClient();
  const { org, leadA } = state();
  const { data: uni } = await svc
    .from('universities')
    .insert({ organization_id: org, name: 'E2E Export Uni', country: 'Canada' })
    .select('id')
    .single();
  const base = { lead_id: leadA, organization_id: org, university_id: uni!.id };
  // Separate inserts: in a bulk insert, a column set on only one row
  // (created_at) is sent as NULL for the others instead of its default.
  // And one after the other: application numbers are max+1 per org, so two
  // concurrent inserts can collide on the unique number.
  const apps: { id: string }[] = [];
  for (const row of [
    { ...base, full_name: 'E2E Export New', intake_season: 'sep_oct', intake_year: 2027, marital_status: 'married', budget_range: '20l_30l', status: 'visa_accepted' },
    { ...base, full_name: 'E2E Export Old', created_at: '2025-03-10T08:00:00Z', intake_season: 'jan_feb', intake_year: 2026 },
  ]) {
    const { data, error } = await svc.from('applications').insert(row).select('id').single();
    if (error) throw new Error(`seed failed: ${error.message}`);
    apps.push(data);
  }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());

  try {
    await login(page);
    await page.goto('/applications');
    await page.getByRole('button', { name: /^export$/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Download all applications created between two dates.', { exact: false })).toBeVisible();
    await dialog.getByLabel('From').fill(today);
    await dialog.getByLabel('To').fill(today);
    const [xlsx] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('link', { name: /download excel/i }).click()]);
    expect(xlsx.suggestedFilename()).toBe(`applications-${today}-to-${today}.xlsx`);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(await xlsx.path());
    const sheet = wb.getWorksheet('Applications')!;
    const header = (sheet.getRow(1).values as string[]).filter(Boolean);
    expect(header).toEqual(expect.arrayContaining(['Application #', 'University', 'Intake', 'Marital Status', 'Budget (PKR)', 'Status', 'Passport Number']));
    const rows: Record<string, unknown>[] = [];
    sheet.eachRow((row, i) => {
      if (i === 1) return;
      rows.push(Object.fromEntries(header.map((h, c) => [h, row.getCell(c + 1).value])));
    });
    const mine = rows.find((r) => r['Full Name'] === 'E2E Export New');
    expect(mine).toMatchObject({ University: 'E2E Export Uni', Intake: 'Sep – Oct', 'Marital Status': 'Married', 'Budget (PKR)': '20 – 30 lac', Status: 'Visa Accepted' });
    expect(rows.some((r) => r['Full Name'] === 'E2E Export Old')).toBe(false);

    await page.getByRole('button', { name: /^export$/i }).click();
    await dialog.getByLabel('From').fill('2025-03-01');
    await dialog.getByLabel('To').fill('2025-03-31');
    await dialog.getByLabel('CSV (.csv)').check();
    const [csv] = await Promise.all([page.waitForEvent('download'), dialog.getByRole('link', { name: /download csv/i }).click()]);
    expect(csv.suggestedFilename()).toBe('applications-2025-03-01-to-2025-03-31.csv');
    const text = readFileSync(await csv.path(), 'utf8');
    expect(text).toContain('E2E Export Old');
    expect(text).toContain('Jan – Feb');
    expect(text).not.toContain('E2E Export New');
  } finally {
    await svc.from('applications').delete().in('id', (apps ?? []).map((a) => a.id));
    await svc.from('universities').delete().eq('id', uni!.id);
  }
});

test('opening the CRM plays the consultancy-branded splash, then gets out of the way', async ({ page }) => {
  test.setTimeout(120000);
  await login(page);

  // Part of the server HTML, so it paints before any JavaScript runs.
  const html = await (await page.request.get('/dashboard')).text();
  expect(html).toContain('app-splash');
  expect(html).toContain('Loading E2E Test Org');

  await page.goto('/dashboard');
  await expect(page.getByRole('status', { name: 'Loading E2E Test Org' })).toBeVisible();
  await expect(page.getByRole('status', { name: /^loading/i })).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByText(/welcome back/i)).toBeVisible();

  // In-app navigation doesn't replay it (the layout persists).
  await page.getByRole('link', { name: 'Leads' }).first().click();
  await page.waitForURL(/\/leads/);
  await expect(page.getByRole('status', { name: /^loading/i })).toHaveCount(0);
});

test('after moving around the app, list filters still apply every time', async ({ page }) => {
  // Guards against the splash being reworked into a Suspense/loading.tsx
  // boundary, which on Next 15 stalled filter navigations after a few
  // in-app page changes.
  test.setTimeout(150000);
  const svc = serviceClient();
  const { org, leadA } = state();
  const { data: unis } = await svc
    .from('universities')
    .insert([
      { organization_id: org, name: 'E2E Nav Leeds', country: 'United Kingdom' },
      { organization_id: org, name: 'E2E Nav Toronto', country: 'Canada' },
    ])
    .select('id');
  const base = { lead_id: leadA, organization_id: org };
  const { data: apps } = await svc
    .from('applications')
    .insert([
      { ...base, full_name: 'Zara Navtest', university_id: unis![0].id },
      { ...base, full_name: 'Omar Navtest', university_id: unis![1].id },
    ])
    .select('id');
  const rows = () => page.locator('tbody tr', { hasText: 'Navtest' });
  try {
    await login(page);
    for (let round = 0; round < 3; round++) {
      await page.getByRole('link', { name: 'Dashboard' }).first().click();
      await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 30000 });
      await page.getByRole('link', { name: 'Applications' }).first().click();
      await expect(rows()).toHaveCount(2, { timeout: 30000 });
      await page.getByLabel('Country').selectOption('Canada');
      await expect(rows()).toHaveCount(1, { timeout: 15000 });
    }
  } finally {
    await svc.from('applications').delete().in('id', (apps ?? []).map((a) => a.id));
    await svc.from('universities').delete().in('id', unis!.map((u) => u.id));
  }
});
