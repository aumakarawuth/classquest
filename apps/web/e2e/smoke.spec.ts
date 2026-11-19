import { expect, test } from '@playwright/test';

test('unauthenticated root goes to Thai login page', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'th');
  await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeVisible();
});

test('unknown route shows not found page (SPA fallback)', async ({ page }) => {
  await page.goto('/does-not-exist');
  await expect(page.getByRole('heading', { name: 'ไม่พบหน้าที่ต้องการ' })).toBeVisible();
});
