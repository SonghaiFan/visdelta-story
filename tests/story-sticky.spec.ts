import { expect, test } from '@playwright/test';
import { weatherDemoDocument } from '../components/story/weather-demo';
import { refreshExampleDraft } from '../components/story/examples';
import { STORY_STORAGE_KEY } from '../components/story/document';

for (const width of [1280, 390]) test(`weather controls stay pinned and usable at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 860 });
  await page.goto('story/?example=weather');
  await expect(page.locator('#weather-story')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'Read story', exact: true }).click();
  const reader = page.getByLabel('Story reading area');
  const sticky = page.locator('.story-sticky');
  await page.getByRole('button', { name: 'Keep their dates', exact: true }).click();
  await expect(page.locator('#weather-story')).toHaveAttribute('data-position', '3');
  await expect.poll(async () => {
    const area = await reader.boundingBox(), panel = await sticky.boundingBox();
    return !!area && !!panel && Math.abs(area.y - panel.y) < 2;
  }).toBe(true);
  await sticky.getByText('Explore another day or measure', { exact: true }).click();
  await expect(page.getByLabel('Weather date', { exact: true })).toBeVisible();
  await page.getByLabel('Weather measure', { exact: true }).selectOption('tmin');
  await expect(page.getByTestId('weather-selection')).toContainText('Daily minimum');
  await expect.poll(async () => {
    const panel = await sticky.boundingBox();
    const chart = await page.locator('#weather-story .story-visual').boundingBox();
    return !!panel && !!chart && chart.y >= panel.y + panel.height;
  }).toBe(true);
  await page.screenshot({ path: test.info().outputPath(`story-sticky-${width}.png`), animations: 'disabled' });
  await sticky.getByText('Explore another day or measure', { exact: true }).click();
  await page.getByRole('button', { name: 'The distribution', exact: true }).click();
  // This far jump prepares uncached native legs after changing the measure.
  await expect(page.locator('#weather-story')).toHaveAttribute('data-position', '6', { timeout: 15000 });
  await expect.poll(async () => {
    const area = await reader.boundingBox(), panel = await sticky.boundingBox();
    return !!area && !!panel && Math.abs(area.y - panel.y) < 2;
  }).toBe(true);
  await expect(page.locator('.story-error')).toHaveCount(0);
});


test('untouched saved weather examples receive Sticky while edited drafts stay intact', async ({ page }) => {
  const previous = { ...weatherDemoDocument, story: weatherDemoDocument.story.replace('<Sticky>\n', '').replace('</Sticky>\n', '') };
  expect(refreshExampleDraft('weather', previous)).toEqual(weatherDemoDocument);
  const edited = { ...previous, story: previous.story.replace('What makes a day exceptional?', 'My own weather story') };
  expect(refreshExampleDraft('weather', edited)).toEqual(edited);
  await page.addInitScript(({ key, draft }) => {
    localStorage.setItem(key, JSON.stringify({ ...draft, exampleId: 'weather', autoRun: true }));
  }, { key: STORY_STORAGE_KEY, draft: previous });
  await page.goto('story/?example=weather');
  await expect(page.locator('.story-sticky')).toHaveCount(1);
  await expect(page.getByText('Explore another day or measure', { exact: true })).toBeVisible();
});
