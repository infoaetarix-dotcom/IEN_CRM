import { test, expect } from '@playwright/test';

test('home page loads with primary CTAs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /start your application/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /staff sign in/i })).toBeVisible();
});

test('apply form renders all key fields', async ({ page }) => {
  await page.goto('/apply');
  await expect(page.getByLabel(/full name/i)).toBeVisible();
  await expect(page.getByLabel(/^email/i)).toBeVisible();
  await expect(page.getByLabel(/date of birth/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /submit application/i })).toBeVisible();
});

test('protected routes redirect to login when unauthenticated', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/leads');
  await expect(page).toHaveURL(/\/login/);
});
