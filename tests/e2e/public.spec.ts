import { test, expect } from '@playwright/test';

test('platform landing page loads with nav sign-in and section anchors', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /^sign in$/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /staff sign in/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^pricing$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /book demo/i }).first()).toBeVisible();
});

test('apply wizard step 1 renders', async ({ page }) => {
  await page.goto('/apply');
  await expect(page.getByText(/step 1 of 3/i)).toBeVisible();
  await expect(page.getByLabel(/full name/i)).toBeVisible();
  await expect(page.getByLabel(/^email/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /continue/i })).toBeVisible();
});

test('protected routes redirect to login when unauthenticated', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/leads');
  await expect(page).toHaveURL(/\/login/);
});
