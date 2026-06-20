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

test('agent sees only their assigned lead, never another agent\'s', async ({
  page,
}) => {
  await login(page, TEST_USERS.agentA.email);

  // Agents have no Agents/Templates nav.
  await expect(page.getByRole('link', { name: /^Agents$/ })).toHaveCount(0);

  await page.goto('/leads');
  await expect(page.getByText('E2E Lead A')).toBeVisible();
  await expect(page.getByText('E2E Lead B')).toHaveCount(0);

  // Direct navigation to the other agent's lead must 404 / not render it.
  const res = await page.goto(`/leads/${state().leadB}`);
  // notFound() returns 404; the lead's name must not be visible regardless.
  expect(res?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: /E2E Lead B/ })).toHaveCount(0);
});
