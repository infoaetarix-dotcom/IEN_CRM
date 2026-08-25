import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { TEST_USERS, TEST_PASSWORD, STATE_FILE, submitLogin } from './helpers';

function state() {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

async function login(page: Page, email: string) {
  await submitLogin(page, email, TEST_PASSWORD);
  await page.waitForURL(/\/dashboard/);
}

async function openEdit(page: Page) {
  await expect(async () => {
    await page.getByRole('button', { name: /edit details/i }).click();
    await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible({
      timeout: 1000,
    });
  }).toPass();
}

test('reference name/note + passport persist across edit reopen and page reload (not blank)', async ({
  page,
}) => {
  await login(page, TEST_USERS.admin.email);
  await page.goto(`/leads/${state().leadA}`);
  await expect(page.getByRole('heading', { name: /E2E Lead A/ })).toBeVisible();

  await openEdit(page);

  // Seeded lead only has name/email/phone, and the editor re-validates every
  // required field on save (leadEditSchema picks the same required set as
  // the public wizard — see lib/validation/lead.ts) — all of these need a
  // real value or save is rejected with a validation message.
  await page.getByLabel('Phone').fill('+923001234567');
  await page.getByLabel('Date of birth').fill('2000-05-01');
  await page.getByLabel('City').fill('Lahore');
  await page.getByLabel('Target country').selectOption('Canada');
  await page.getByLabel('Highest education level').selectOption("Bachelor's degree");
  await page.getByLabel('Last qualification / field').fill('BSc Computer Science');
  await page.getByLabel('Institution / board attended').fill('Test University');
  await page.getByLabel('Passing year').selectOption('2022');
  await page.getByLabel('Grading system').selectOption('cgpa_4');
  await page.getByLabel('Result (CGPA / %)').fill('3.5');
  await page.getByLabel('Source').selectOption('personal_reference');
  await page.getByLabel('Name', { exact: true }).fill('Referring Person');
  await page.getByLabel('Note').fill('Met at a fair, very interested.');
  await page.getByLabel('Passport number').fill('AB1234567');
  await page.getByRole('button', { name: /save changes/i }).click();

  // Read-only view shows the saved values.
  await expect(page.getByRole('button', { name: /edit details/i })).toBeVisible();
  await expect(page.getByText('Referring Person')).toBeVisible();
  await expect(page.getByText('Met at a fair, very interested.')).toBeVisible();
  await expect(page.getByText('AB1234567')).toBeVisible();

  // Reopening edit mode must NOT show these fields blank — the exact bug
  // being fixed (previously they were a one-time note log, not persisted
  // fields, so reopening always started empty).
  await openEdit(page);
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Referring Person');
  await expect(page.getByLabel('Note')).toHaveValue('Met at a fair, very interested.');
  await expect(page.getByLabel('Passport number')).toHaveValue('AB1234567');
  await page.getByRole('button', { name: /cancel/i }).click();

  // Survives a full page reload too.
  await page.reload();
  await openEdit(page);
  await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Referring Person');
  await expect(page.getByLabel('Note')).toHaveValue('Met at a fair, very interested.');
  await expect(page.getByLabel('Passport number')).toHaveValue('AB1234567');
});

test('Program of interest sits on its own full-width line in the Goals card', async ({
  page,
}) => {
  await login(page, TEST_USERS.admin.email);
  await page.goto(`/leads/${state().leadA}`);
  await openEdit(page);

  const institutionY = (
    await page.locator('label', { hasText: 'Preferred institution (abroad)' }).boundingBox()
  )?.y;
  const fundingY = (
    await page.locator('label', { hasText: 'How will they fund their studies?' }).boundingBox()
  )?.y;
  const programY = (
    await page.locator('label', { hasText: 'Program of interest' }).boundingBox()
  )?.y;
  const intakeY = (
    await page.locator('label', { hasText: 'Intake season' }).boundingBox()
  )?.y;

  expect(institutionY).toBeDefined();
  expect(fundingY).toBeDefined();
  expect(programY).toBeDefined();
  expect(intakeY).toBeDefined();

  // Institution and Funding are still the same grid row.
  expect(Math.abs(institutionY! - fundingY!)).toBeLessThan(10);
  // Program dropped to its own row below them...
  expect(programY!).toBeGreaterThan(institutionY! + 20);
  // ...and pushed everything after it down another row.
  expect(intakeY!).toBeGreaterThan(programY! + 20);
});

test('lead status offers exactly the 4 collapsed stages and records history correctly', async ({
  page,
}) => {
  await login(page, TEST_USERS.admin.email);
  await page.goto(`/leads/${state().leadB}`);
  await expect(page.getByRole('heading', { name: /E2E Lead B/ })).toBeVisible();

  const statusSelect = page.locator('select').first();
  const labels = await statusSelect.locator('option').allTextContents();
  expect(labels).toEqual([
    'Raw lead',
    'Document processing',
    'Application generated',
    'Rejected',
  ]);

  await statusSelect.selectOption('document_processing');
  await expect(page.getByText('Document processing').first()).toBeVisible();

  await statusSelect.selectOption('application_generated');
  await expect(page.getByText('Application generated').first()).toBeVisible();

  await statusSelect.selectOption('rejected');
  await expect(page.getByText('Rejected').first()).toBeVisible();
});
