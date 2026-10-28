import { expect, test } from '@playwright/test';

test('a percentile change updates the visible native chart without rebuilding the chapter', async ({ page }) => {
  test.setTimeout(45000);
  await page.goto('story/?example=weather#weather-year-stack');
  const chapter = page.locator('#weather-story');
  await expect(chapter).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
  await expect(chapter).toHaveAttribute('data-position', '3');
  await expect(chapter.locator('circle.vd-point')).toHaveCount(118);
  const result = await page.evaluate(async () => {
    const chapter = document.querySelector('#weather-story')!;
    const before = chapter.querySelector('.story-chart-mount');
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Extreme weather percentile"]')!;
    const start = performance.now();
    // Dispatch native input without scrolling to the control above this chapter.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '100');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    let marks = 0;
    while (performance.now() - start < 15000) {
      await new Promise(resolve => setTimeout(resolve, 16));
      const mount = [...chapter.querySelectorAll('.story-chart-mount')].find(node => getComputedStyle(node).visibility !== 'hidden');
      marks = mount?.querySelectorAll('circle.vd-point').length ?? 0;
      if (marks === 21 && chapter.getAttribute('data-ready') === 'true') break;
    }
    return { elapsed: performance.now() - start, marks, sameMount: before === chapter.querySelector('.story-chart-mount') };
  });
  console.log('Story slider response:', result);
  expect(result.marks).toBe(21);
  expect(result.elapsed).toBeLessThan(500);
  expect(result.sameMount).toBe(true);
  const latest = await page.evaluate(async () => {
    const chapter = document.querySelector('#weather-story')!;
    const input = document.querySelector<HTMLInputElement>('input[aria-label="Extreme weather percentile"]')!;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    let lastInput = 0;
    for (const value of [96, 100, 97, 99, 95]) {
      setter.call(input, String(value));
      lastInput = performance.now();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    while (performance.now() - lastInput < 3000) {
      await new Promise(resolve => setTimeout(resolve, 16));
      if (chapter.getAttribute('data-ready') === 'true' && chapter.querySelectorAll('circle.vd-point').length === 118) break;
    }
    return { elapsed: performance.now() - lastInput, marks: chapter.querySelectorAll('circle.vd-point').length };
  });
  console.log('Latest slider input response:', latest);
  expect(latest.marks).toBe(118);
  expect(latest.elapsed).toBeLessThan(500);
  await page.getByRole('button', { name: 'Read their temperatures', exact: true }).click();
  await expect(chapter).toHaveAttribute('data-position', '4');
  await expect(chapter.locator('circle.vd-point')).toHaveCount(118);
  await page.getByRole('button', { name: 'Keep their dates', exact: true }).click();
  await expect(chapter).toHaveAttribute('data-position', '3');
  await expect(chapter.locator('circle.vd-point')).toHaveCount(118);
  await page.setViewportSize({ width: 1100, height: 780 });
  await expect(chapter.locator('svg').first()).toBeVisible();
  await expect(page.locator('.story-error')).toHaveCount(0);
});

test('lazy playback and live updates use a builder supplied chart module', async ({ page }) => {
  await page.goto('story/');
  await expect(page.locator('.story-scrolly')).toHaveAttribute('data-ready', 'true');
  await page.getByLabel('Story MDX', { exact: true }).click();
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('ControlOrMeta+Shift+End');
  await page.keyboard.insertText(`import { bar, barModule } from 'visdelta/bar'
import rows from './data.json'

export const customModule = { key: 'bar', async load() {
  const loaded = await barModule.load();
  return { ...loaded, plugin: { ...loaded.plugin, createChartType(runtime) {
    const type = loaded.plugin.createChartType(runtime);
    return { ...type, renderer(...args) {
      globalThis.storyCustomRenders = (globalThis.storyCustomRenders || 0) + 1;
      return type.renderer(...args);
    } };
  } } };
} }
export const wrap = state => ({ toSpec: () => state.toSpec(), rows: () => state.rows(), chartModule: () => customModule })
export const base = bar(rows).x('region').y('revenue')
export const model = ({ minimum }) => ({ views: { all: wrap(base), selected: wrap(base.where({ revenue: { gte: minimum } })) } })

<Story>
<Var name="minimum" value={15} />
<StoryData model={model} bind={['minimum']}>
<Range bind="minimum" label="Custom minimum" max={18} />
<Scrolly id="custom-native">
<Step view="all" title="Custom overview">Overview.</Step>
<Step view="selected" title="Custom selection">Selection.</Step>
</Scrolly>
</StoryData>
</Story>`);
  const chapter = page.locator('#custom-native');
  await expect(chapter).toHaveAttribute('data-ready', 'true');
  expect(await page.evaluate(() => (globalThis as typeof globalThis & { storyCustomRenders: number }).storyCustomRenders)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Custom selection', exact: true }).click();
  await expect(chapter).toHaveAttribute('data-position', '1');
  await expect(chapter.locator('.vd-bar')).toHaveCount(1);
  await page.getByLabel('Custom minimum', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Custom selection', exact: true }).click();
  await expect(chapter.locator('.vd-bar')).toHaveCount(3);
  await page.getByRole('button', { name: 'Custom overview', exact: true }).click();
  await expect(chapter).toHaveAttribute('data-position', '0');
  await expect(page.locator('.story-error')).toHaveCount(0);
});
