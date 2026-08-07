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

test('agents share visibility into every lead in their organization', async ({
  page,
}) => {
  await login(page, TEST_USERS.agentA.email);

  // Agents have no Agents/Templates nav.
  await expect(page.getByRole('link', { name: /^Agents$/ })).toHaveCount(0);

  await page.goto('/leads');
  await expect(page.getByText('E2E Lead A')).toBeVisible();
  await expect(page.getByText('E2E Lead B')).toBeVisible();

  // Direct navigation to a same-org lead assigned to another agent now works
  // — assigned_to is no longer a visibility boundary, only organization_id is.
  const res = await page.goto(`/leads/${state().leadB}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: /E2E Lead B/ })).toBeVisible();
});
