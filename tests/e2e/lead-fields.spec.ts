import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { TEST_USERS, TEST_PASSWORD, STATE_FILE, submitLogin, serviceClient } from './helpers';

function state() {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

async function login(page: Page) {
  await submitLogin(page, TEST_USERS.admin.email, TEST_PASSWORD);
  await page.waitForURL(/\/dashboard/, { timeout: 60000 });
}

function todayKarachi() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
}

/**
 * Marital status, budget and the Jan–Feb / Apr–May / Sep–Oct intakes on
 * the public form and Create query; the date-range leads export; and the
 * applications table's search + filters.
 */

test('public form: marital status is required, budget and intake are saved', async ({ page }) => {
  test.setTimeout(150000);
  const svc = serviceClient();
  const email = `e2e_public_${Date.now()}@example.com`;

  try {
    await page.goto('/e2e-test-org/apply');

    // Step 1 — contact (country defaults to the UK).
    await page.getByLabel(/full name/i).fill('E2E Public Applicant');
    await page.locator('#email').fill(email);
    await page.locator('input[type="tel"]').fill('3001234567');
    await page.locator('input[name="consent_given"]').check();
    await page.getByRole('button', { name: /continue/i }).first().click();
    await expect(page.getByLabel('Marital status')).toBeVisible({ timeout: 30000 });

    // Step 2 — background, first without marital status.
    await page.getByRole('button', { name: /select your date of birth/i }).click();
    await page.getByRole('gridcell', { name: '15' }).first().click();
    await page.locator('#city').fill('Lahore');
    await page.locator('select', { has: page.locator('option', { hasText: 'Select your education level' }) }).selectOption({ index: 2 });
    await page.locator('#last_qualification').fill('BSc Computer Science');
    await page.locator('#prior_institution').fill('University of the Punjab');
    await page.locator('#passing_year').selectOption({ index: 2 });
    await page.locator('#grading_system').selectOption('percentage');
    await page.locator('#grade_value').fill('80');
    await page.getByRole('button', { name: /continue/i }).click(); // only step 2's is visible now
    await expect(page.getByText('Please select your marital status')).toBeVisible({ timeout: 30000 });

    await page.getByLabel('Marital status').selectOption('married');
    await page.getByRole('button', { name: /continue/i }).click(); // only step 2's is visible now
    await expect(page.getByLabel(/your budget for studying abroad/i)).toBeVisible({ timeout: 30000 });

    // Step 3 — budget + new intake options.
    await expect(page.locator('#intake_season option')).toHaveText(['Intake', 'Jan – Feb', 'Apr – May', 'Sep – Oct']);
    await page.getByLabel(/your budget for studying abroad/i).selectOption('10l_20l');
    await page.locator('#intake_season').selectOption('sep_oct');
    await page.getByLabel('Intake year').selectOption({ index: 2 });
    await page.getByRole('button', { name: /submit application/i }).click();
    await page.waitForURL(/thank-you/, { timeout: 60000 });

    const { data: lead } = await svc
      .from('leads')
      .select('marital_status, budget_range, intake_season, intake_year, is_complete')
      .eq('email', email)
      .single();
    expect(lead).toMatchObject({ marital_status: 'married', budget_range: '10l_20l', intake_season: 'sep_oct', is_complete: true });
    expect(lead!.intake_year).toBeGreaterThanOrEqual(2026);
  } finally {
    await svc.from('leads').delete().eq('email', email);
  }
});

test('Create query: marital status, budget and intake are optional and saved', async ({ page }) => {
  test.setTimeout(150000);
  const svc = serviceClient();
  const name = `E2E Query ${Date.now()}`;

  try {
    await login(page);
    await page.goto('/leads');
    await page.getByRole('button', { name: /create query/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#full_name').fill(name);
    await dialog.getByLabel('Marital status').selectOption('single');
    await dialog.getByLabel(/budget for studying abroad/i).selectOption('above_1cr');
    await dialog.locator('#intake_season').selectOption('jan_feb');
    await dialog.getByRole('button', { name: /^save$/i }).click();
    await page.waitForURL(/\/leads\/[0-9a-f-]{36}$/, { timeout: 60000 });

    // Shown on the lead's page, and stored as codes.
    await expect(page.getByText('Single')).toBeVisible();
    await expect(page.getByText('Above 1 crore')).toBeVisible();
    await expect(page.getByText(/Jan – Feb/)).toBeVisible();
    const { data: lead } = await svc
      .from('leads')
      .select('marital_status, budget_range, intake_season')
      .eq('full_name', name)
      .single();
    expect(lead).toEqual({ marital_status: 'single', budget_range: 'above_1cr', intake_season: 'jan_feb' });
  } finally {
    await svc.from('leads').delete().eq('full_name', name);
  }
});

test('leads export: pick dates and format, download only leads received in that range', async ({ page }) => {
  test.setTimeout(150000);
  const svc = serviceClient();
  const { org } = state() as { org: string };
  const today = todayKarachi();

  // One lead received long ago — must not be in a "today" export.
  const { data: old } = await svc
    .from('leads')
    .insert({
      organization_id: org,
      full_name: 'E2E Old Lead',
      consent_given: true,
      utm_source: 'website',
      created_at: '2025-01-15T08:00:00Z',
      marital_status: 'married',
      budget_range: '20l_30l',
    })
    .select('id')
    .single();

  try {
    await login(page);
    await page.goto('/leads');
    await page.getByRole('button', { name: /^export$/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('From').fill(today);
    await dialog.getByLabel('To').fill(today);

    const [xlsx] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByRole('link', { name: /download excel/i }).click(),
    ]);
    expect(xlsx.suggestedFilename()).toBe(`leads-${today}-to-${today}.xlsx`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(await xlsx.path());
    const sheet = wb.getWorksheet('Leads')!;
    const header = (sheet.getRow(1).values as string[]).filter(Boolean);
    expect(header).toEqual(expect.arrayContaining(['Marital Status', 'Budget (PKR)', 'Intake']));
    const names: string[] = [];
    sheet.eachRow((row, i) => i > 1 && names.push(String(row.getCell(2).value)));
    expect(names).toContain('E2E Lead A');
    expect(names).not.toContain('E2E Old Lead');

    // CSV for a range that covers the old lead.
    await page.getByRole('button', { name: /^export$/i }).click();
    await dialog.getByLabel('From').fill('2025-01-01');
    await dialog.getByLabel('To').fill('2025-01-31');
    await dialog.getByLabel('CSV (.csv)').check();
    const [csv] = await Promise.all([
      page.waitForEvent('download'),
      dialog.getByRole('link', { name: /download csv/i }).click(),
    ]);
    expect(csv.suggestedFilename()).toBe('leads-2025-01-01-to-2025-01-31.csv');
    const text = readFileSync(await csv.path(), 'utf8');
    expect(text).toContain('E2E Old Lead');
    expect(text).toContain('Married');
    expect(text).toContain('20 – 30 lac');
    expect(text).not.toContain('E2E Lead A');
  } finally {
    await svc.from('leads').delete().eq('id', old!.id);
  }
});

test('applications table: search box and filters', async ({ page }) => {
  test.setTimeout(150000);
  const svc = serviceClient();
  const { org, leadA } = state() as { org: string; leadA: string };
  const { data: unis } = await svc
    .from('universities')
    .insert([
      { organization_id: org, name: 'E2E Filter Leeds', country: 'United Kingdom' },
      { organization_id: org, name: 'E2E Filter Toronto', country: 'Canada' },
    ])
    .select('id, name');
  const leeds = unis!.find((u) => u.name === 'E2E Filter Leeds')!;
  const toronto = unis!.find((u) => u.name === 'E2E Filter Toronto')!;
  const base = { lead_id: leadA, organization_id: org };
  const { data: apps } = await svc
    .from('applications')
    .insert([
      { ...base, full_name: 'Zara Filtertest', passport_number: 'ZP1234567', university_id: leeds.id, status: 'visa_accepted', intake_season: 'sep_oct', intake_year: 2027 },
      { ...base, full_name: 'Omar Filtertest', university_id: toronto.id, status: 'conditional_offer', intake_season: 'jan_feb', intake_year: 2027 },
    ])
    .select('id');

  const rows = () => page.locator('tbody tr', { hasText: 'Filtertest' });
  try {
    await login(page);
    await page.goto('/applications');
    await expect(rows()).toHaveCount(2);

    await page.getByLabel('Search applications').fill('zp1234567');
    await expect(rows()).toHaveCount(1, { timeout: 15000 });
    await expect(rows().first()).toContainText('Zara Filtertest');

    await page.getByRole('link', { name: /clear filters/i }).click();
    await expect(rows()).toHaveCount(2, { timeout: 15000 });

    await page.getByLabel('Country').selectOption('Canada');
    await expect(rows()).toHaveCount(1, { timeout: 15000 });
    await expect(rows().first()).toContainText('Omar Filtertest');

    await page.goto('/applications');
    await page.getByLabel('Intake', { exact: true }).selectOption('sep_oct');
    await expect(rows()).toHaveCount(1, { timeout: 15000 });
    await page.getByLabel('Status').selectOption('conditional_offer');
    await expect(page.getByText('No applications match your filters.')).toBeVisible({ timeout: 15000 });

    await page.goto('/applications');
    await page.getByLabel('University').selectOption('E2E Filter Leeds');
    await expect(rows()).toHaveCount(1, { timeout: 15000 });
    await expect(rows().first()).toContainText('Zara Filtertest');
  } finally {
    await svc.from('applications').delete().in('id', (apps ?? []).map((a) => a.id));
    await svc.from('universities').delete().in('id', [leeds.id, toronto.id]);
  }
});

test('creating an application copies marital status, budget, intake and a letter grade from the lead', async ({
  page,
}) => {
  test.setTimeout(150000);
  const svc = serviceClient();
  const { org, leadA } = state() as { org: string; leadA: string };
  const uniName = `E2E Copy Uni ${Date.now()}`;
  await svc
    .from('leads')
    .update({
      marital_status: 'married',
      budget_range: '30l_50l',
      intake_season: 'apr_may',
      intake_year: 2027,
      grading_system: 'grade',
      grade_letter: 'A-',
      grade_value: null,
      // The seeded test phone is deliberately fake; applications validate it.
      phone: '+923001234567',
    })
    .eq('id', leadA);

  try {
    await login(page);
    await page.goto(`/leads/${leadA}`);
    await page.getByRole('button', { name: /create application/i }).click();
    const dialog = page.getByRole('dialog');
    // Add the university in place (auto-selected), then continue to the form.
    await dialog.getByRole('button', { name: /university not listed\? add it here/i }).click();
    await dialog.getByLabel('University name').fill(uniName);
    await dialog.getByRole('button', { name: /^add university$/i }).click();
    await expect(dialog.getByRole('combobox')).toContainText(uniName, { timeout: 30000 });
    await dialog.getByRole('button', { name: /^continue$/i }).click();

    // The form is pre-filled from the lead.
    await expect(dialog.locator('#marital_status')).toHaveValue('married', { timeout: 30000 });
    await expect(dialog.locator('#budget_range')).toHaveValue('30l_50l');
    await expect(dialog.locator('#intake_season')).toHaveValue('apr_may');
    await expect(dialog.locator('#grade_letter')).toHaveValue('A-');
    await dialog.getByRole('button', { name: /create application/i }).click();
    await page.waitForURL(/\/applications\/[0-9a-f-]{36}$/, { timeout: 60000 });

    const appId = page.url().split('/').pop()!;
    const { data: app } = await svc
      .from('applications')
      .select('marital_status, budget_range, intake_season, intake_year, grading_system, grade_letter, grade_value')
      .eq('id', appId)
      .single();
    expect(app).toEqual({
      marital_status: 'married',
      budget_range: '30l_50l',
      intake_season: 'apr_may',
      intake_year: 2027,
      grading_system: 'grade',
      grade_letter: 'A-',
      grade_value: null,
    });
    await expect(page.getByText('A- — ')).toBeVisible();
    await expect(page.getByText('30 – 50 lac')).toBeVisible();
  } finally {
    await svc.from('applications').delete().eq('lead_id', leadA);
    await svc.from('universities').delete().eq('organization_id', org).eq('name', uniName);
    await svc
      .from('leads')
      .update({ marital_status: null, budget_range: null, intake_season: null, intake_year: null, grade_letter: null, phone: '+10000000001' })
      .eq('id', leadA);
  }
});
