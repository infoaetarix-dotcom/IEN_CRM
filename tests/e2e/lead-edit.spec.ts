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

test('admin edits a lead inline and the change persists', async ({ page }) => {
  await login(page, TEST_USERS.admin.email);
  await page.goto(`/leads/${state().leadA}`);
  await expect(page.getByRole('heading', { name: /E2E Lead A/ })).toBeVisible();

  const newCity = `Testville ${Date.now()}`;

  // Retry the click until edit mode is actually active — guards against the
  // SSR hydration race where a click can land before React attaches handlers.
  await expect(async () => {
    await page.getByRole('button', { name: /edit details/i }).click();
    await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible({
      timeout: 1000,
    });
  }).toPass();

  // The seeded lead has only name/email/phone, so fill every required field
  // (this also exercises the full save path, not just one input).
  // Seeded phone is a placeholder that fails real validation; set a valid one
  // (the editor re-validates every field on save).
  await page.getByLabel('Phone').fill('+923001234567');
  await page.getByLabel('Date of birth').fill('2000-05-01');
  await page.getByLabel('City').fill(newCity);
  await page.getByLabel('Target country').selectOption('Canada');
  await page.getByLabel('Highest education').selectOption("Bachelor's degree");
  // 'Qualification' alone is now ambiguous — it substring-matches both
  // "Last qualification / field" and ProgramField's "Qualification type".
  // This was testing the latter (BSc is a DEGREE_OPTIONS value).
  await page.getByLabel('Qualification type').selectOption('BSc');
  await page.getByLabel('Institution attended').fill('Test University');
  await page.getByLabel('Passing year').selectOption('2022');
  await page.getByLabel('Grading system').selectOption('cgpa_4');
  await page.getByLabel('Result').fill('3.5');

  await page.getByRole('button', { name: /save changes/i }).click();

  // Editor collapses back to the read-only view showing the new value.
  await expect(page.getByRole('button', { name: /edit details/i })).toBeVisible();
  await expect(page.getByText(newCity)).toBeVisible();

  // Persisted server-side: a fresh load still shows it.
  await page.reload();
  await expect(page.getByText(newCity)).toBeVisible();
});
