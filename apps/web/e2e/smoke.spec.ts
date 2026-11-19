import { expect, test } from '@playwright/test';

test('home page loads in Thai', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'th');
  await expect(page.getByRole('heading', { name: 'ClassQuest' })).toBeVisible();
});

test('unknown route shows not found page (SPA fallback)', async ({ page }) => {
  await page.goto('/does-not-exist');
  await expect(page.getByRole('heading', { name: 'ไม่พบหน้าที่ต้องการ' })).toBeVisible();
});
