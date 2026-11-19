import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const path of ['/student', '/teacher/reviews', '/admin/users']) {
  test(`${path} requires sign-in`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  });
}

test('login page passes axe and explains missing configuration', async ({ page }) => {
  // E2E builds run without Supabase env, so sign-in must be visibly unavailable, not a dead button.
  await page.goto('/login');
  await expect(page.getByRole('button', { name: 'เข้าสู่ระบบด้วย Google' })).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('ยังไม่ได้เชื่อมต่อฐานข้อมูล');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations).toEqual([]);
});

test('OAuth domain error is shown in Thai', async ({ page }) => {
  await page.goto('/login?error=server_error&error_description=Database+error+saving+new+user');
  await expect(page.getByRole('alert')).toContainText('โดเมนของสถานศึกษา');
});
