import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const areas = [
  { base: '/student', menu: 'เมนูนักเรียน', target: 'ภารกิจ', url: '/student/quests' },
  { base: '/teacher', menu: 'เมนูครูผู้สอน', target: 'ตรวจงาน', url: '/teacher/reviews' },
  { base: '/admin', menu: 'เมนูผู้ดูแลระบบ', target: 'Audit Log', url: '/admin/audit' },
];

for (const area of areas) {
  test(`${area.base} shell navigates and passes axe`, async ({ page, isMobile }) => {
    await page.goto(area.base);
    const nav = isMobile
      ? page.getByRole('navigation', { name: area.menu.replace('เมนู', 'เมนูหลัก') })
      : page.getByRole('navigation', { name: area.menu });
    await nav.getByRole('link', { name: area.target }).click();
    await expect(page).toHaveURL(area.url);
    await expect(page.getByRole('heading', { level: 1, name: area.target })).toBeVisible();
    await expect(page.getByText('ฟีเจอร์นี้กำลังพัฒนา')).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations).toEqual([]);
  });
}

test('skip link moves focus to main content', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard test runs on desktop');
  await page.goto('/student');
  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'ข้ามไปยังเนื้อหาหลัก' });
  await expect(skip).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
});

for (const width of [360, 768, 1280]) {
  test(`no horizontal scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ['/student', '/teacher', '/admin']) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(overflow, path).toBe(false);
    }
  });
}
