import { expect, test } from '@playwright/test';
const pages = ['quick-start', 'charts', 'bindings', 'styling', 'projects', 'weather', 'deployment', 'reference'];
for (const width of [1280, 390]) test(`independent docs, Markdown exports and static search work at ${width}px`, async ({ page, request, baseURL }) => {
  await page.setViewportSize({ width, height: 860 });
  await page.goto('docs/');
  await expect(page.getByRole('heading', { name: 'VisDelta Story', exact: true })).toBeVisible();
  if (width === 1280) await expect(page.locator('#nd-sidebar')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const path of pages) {
    const response = await request.get(`docs/${path}/`);
    expect(response.ok(), path).toBe(true);
    expect(await response.text()).toContain('Story Documentation');
    const md = await request.get(`llms.mdx/docs/${path}/content.md`);
    expect(md.ok(), `${path} Markdown`).toBe(true);
    expect(await md.text()).toMatch(/^# /);
  }
  const index = await request.get('llms.txt');
  expect(await index.text()).toContain('visdelta-story/llms.mdx/docs/bindings/content.md');
  await page.getByRole('button', { name: /search/i }).first().click();
  const input = page.getByRole('dialog').getByRole('combobox');
  await input.fill('Variables');
  const result = page.getByRole('dialog').getByRole('option', { name: /Variables and controls/ }).first();
  await expect(result).toBeVisible();
  await result.click();
  await expect(page).toHaveURL(/\/docs\/bindings/);
  const base = new URL(baseURL!).pathname.replace(/\/$/, '');
  await expect(page.getByRole('link', { name: 'Docs', exact: true })).toHaveAttribute('href', `${base}/docs/`);
});
