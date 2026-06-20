import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { TEST_USERS, TEST_PASSWORD, STATE_FILE } from './helpers';

function state() {
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/dashboard/);
}

test('admin can sign in, see dashboard, open a lead and change its status', async ({
  page,
}) => {
  await login(page, TEST_USERS.admin.email);

  // Dashboard metrics + admin-only nav visible.
  await expect(page.getByText(/leads this month/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /^Agents$/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Templates$/ })).toBeVisible();

  // Open lead A directly and change status to Contacted.
  await page.goto(`/leads/${state().leadA}`);
  await expect(page.getByRole('heading', { name: /E2E Lead A/ })).toBeVisible();
  await page
    .locator('select')
    .first()
    .selectOption('contacted');
  // Status history should record the change.
  await expect(page.getByText(/Contacted/).first()).toBeVisible();

  // Sign out.
  await page.getByRole('button', { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/login/);
});

test('admin-only pages are reachable by admin', async ({ page }) => {
  await login(page, TEST_USERS.admin.email);
  await page.goto('/agents');
  await expect(page.getByRole('heading', { name: /agents/i })).toBeVisible();
  await page.goto('/templates');
  await expect(page.getByRole('heading', { name: /templates/i })).toBeVisible();
});
