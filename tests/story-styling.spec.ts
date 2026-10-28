import { expect, test, type Page } from '@playwright/test';
async function edit(page: Page, source: string) {
  await page.getByLabel('Story MDX', { exact: true }).click();
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('ControlOrMeta+Shift+End');
  await page.keyboard.insertText(source);
}
// Assemble these at runtime so the site build cannot pre-generate the test CSS.
const utility = (...pieces: string[]) => pieces.join('');
const padding = utility('p-', '[13px]');
const background = utility('bg-', '[#13579b]');
const headingSize = utility('text-', '[17px]');
const hover = utility('hover:bg-', '[#97531a]');
const responsive = utility('md:grid-cols-', '[1fr_2fr]');

test('HTML and newly entered Tailwind classes style the preview without changing Studio UI', async ({ page }) => {
  await page.goto('story/');
  const outside = await page.locator('.story-toolbar').evaluate(node => getComputedStyle(node).backgroundColor);
  await edit(page, `<div data-testid="custom-card" className="${padding} ${background} ${hover} grid ${responsive}">
<h2 className="${headingSize}">A custom HTML card</h2>
<div style={{ color: 'rgb(12, 34, 56)' }}>Inline styles work too.</div>
</div>

<Story>
<Var name="day" value="2022-02-14" />
<Controls className="${utility('p-', '[7px]')}"><DatePicker bind="day" label="Date" /></Controls>
</Story>`);
  const card = page.getByTestId('custom-card');
  await expect(card).toHaveCSS('padding-top', '13px');
  await expect(card).toHaveCSS('background-color', 'rgb(19, 87, 155)');
  await expect(card.locator('h2')).toHaveCSS('font-size', '17px');
  await expect(page.locator('.story-controls')).toHaveCSS('padding-top', '7px');
  await expect(page.getByText('Inline styles work too.', { exact: true })).toHaveCSS('color', 'rgb(12, 34, 56)');
  await card.hover();
  await expect(card).toHaveCSS('background-color', 'rgb(151, 83, 26)');
  expect(await page.locator('.story-toolbar').evaluate(node => getComputedStyle(node).backgroundColor)).toBe(outside);
  const columns = await card.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').map(parseFloat));
  expect(columns[1] / columns[0]).toBeCloseTo(2, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => card.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(1);
  await expect(page.locator('.story-error')).toHaveCount(0);
});

test('custom component class changes generate styles and app theme tokens remain available', async ({ page }) => {
  await page.goto('story/');
  const outsideColor = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-violet-700'));
  const dynamicPadding = utility('p-', '[29px]');
  const dark = utility('dark:bg-', '[#123456]');
  await edit(page, `import { useState } from 'react'

export function Card() {
  const [large, setLarge] = useState(false)
  return <button data-testid="dynamic-card" className={large ? '${dynamicPadding}' : '${padding}'} onClick={() => setLarge(!large)}>Resize my card</button>
}

<Card />
<div data-testid="palette-card" className="${utility('bg-', 'violet-700')}">A default palette color.</div>
<Hero className="text-state-a">A themed component.</Hero>
<div data-testid="theme-card" className="${background} ${dark}">Theme-aware HTML.</div>`);
  const card = page.getByTestId('dynamic-card');
  await expect(card).toHaveCSS('padding-top', '13px');
  await card.click();
  await expect(card).toHaveCSS('padding-top', '29px');
  await expect(page.getByTestId('palette-card')).toHaveCSS('background-color', /oklch/);
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-violet-700'))).toBe(outsideColor);
  const expected = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--color-state-a').trim());
  expect(expected).not.toBe('');
  await expect(page.locator('.story-hero')).toHaveCSS('color', 'rgb(66, 105, 208)');
  await page.evaluate(() => document.documentElement.classList.add('dark'));
  await expect(page.getByTestId('theme-card')).toHaveCSS('background-color', 'rgb(18, 52, 86)');
  await expect(page.locator('.story-error')).toHaveCount(0);
});
