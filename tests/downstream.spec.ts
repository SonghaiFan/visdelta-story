import { expect, test } from '@playwright/test';
test('the independent root, guide and public chart imports work', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByLabel('Story MDX', { exact: true })).toBeVisible();
  await expect(page.locator('.story-chart svg')).toBeVisible();
  await expect(page.locator('.story-error')).toHaveCount(0);
  await page.getByRole('link', { name: 'Docs', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'VisDelta Story', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Component reference', exact: true }).first().click();
  await expect(page).toHaveURL(/\/docs\/reference/);
  await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', /\/docs\/reference/);
  const base = new URL(page.url()).pathname.split('/docs/')[0];
  const response = await page.request.get(`${base}/llms-full.txt`);
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain('StoryData');
});
