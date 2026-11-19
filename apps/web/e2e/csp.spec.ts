import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// Apply the production CSP from public/_headers to the preview build and make sure nothing is blocked.
const csp =
  /Content-Security-Policy: (.+)/.exec(readFileSync('public/_headers', 'utf8'))?.[1] ?? '';

test('app runs under the production Content-Security-Policy', async ({ page }) => {
  expect(csp).toContain("script-src 'self'");
  const violations: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  await page.route('**/*', async (route) => {
    const req = route.request();
    if (req.resourceType() !== 'document') return route.continue();
    const res = await route.fetch();
    await route.fulfill({
      response: res,
      headers: { ...res.headers(), 'content-security-policy': csp },
    });
  });
  await page.addInitScript(() => localStorage.setItem('classquest.theme', 'dark'));
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'เข้าสู่ระบบ' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect(violations).toEqual([]);
});
