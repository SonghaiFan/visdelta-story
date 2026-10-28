import { expect, test, type Page } from '@playwright/test';
import { weatherDocument } from '../components/story/weather';
import { initialDocument } from '../components/story/document';

async function edit(page: Page, label: string, value: string) {
  const editor = page.getByLabel(label, { exact: true });
  await editor.click();
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('ControlOrMeta+Shift+End');
  await page.keyboard.insertText(value);
}
async function ready(page: Page) {
  await page.goto('story/');
  await expect(page.locator('.story-scrolly').first()).toHaveAttribute('data-ready', 'true');
}

// This is the public editor contract, not a snapshot of the implementation.
test('the whole story scrolls forward/backward and navigation restores exact states', async ({ page }) => {
  await ready(page);
  const scrolly = page.locator('.story-scrolly');
  const marks = page.locator('.story-chart .vd-bar');
  expect(await page.getByLabel('Story reading area').evaluate(node => node.clientHeight)).toBeLessThan(860);
  const before = await marks.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).opacity));
  await page.getByRole('button', { name: 'North', exact: true }).click();
  await expect(scrolly).toHaveAttribute('data-position', '1');
  await expect.poll(() => marks.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).opacity))).not.toEqual(before);
  await expect(page).toHaveURL(/#north$/);
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(scrolly).toHaveAttribute('data-position', '0');
  await expect.poll(() => marks.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).opacity))).toEqual(before);
  await page.getByRole('button', { name: 'Compare again', exact: true }).click();
  await expect(scrolly).toHaveAttribute('data-position', '2');
  await expect.poll(() => marks.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).opacity))).toEqual(before);
  await page.reload();
  await expect(scrolly).toHaveAttribute('data-position', '2');
  await page.getByLabel('Story reading area').evaluate(node => { node.scrollTop = 0; });
  await expect(scrolly).toHaveAttribute('data-position', '0');
});

test('native MDX imports, exports, custom components, fragments and GFM compose real steps', async ({ page }) => {
  await ready(page);
  await edit(page, 'Story MDX', `import { bar as bars } from 'visdelta/bar'
import rows from './data.json'
import { Step } from './story-components.js'

export const chart = bars(rows).x('region').y('revenue')
export const title = 'A composed MDX story'
export function Region({ name }) {
  return <Step chart={chart.highlight({ region: name })} title={name} id={name}><h2>{name}</h2></Step>
}

# {title}

| Region | Revenue |
| --- | ---: |
| North | 18 |

<Scrolly id="custom" layout="right" theme="paper" chartStyle="paper">
  <><Step id="start" title="Start" chart={chart}><h2>Start here</h2></Step></>
  {['North', 'South'].map(name => <Region key={name} name={name} />)}
</Scrolly>`);
  await expect(page.getByRole('heading', { name: 'A composed MDX story' })).toBeVisible();
  await expect(page.locator('.story-document table')).toHaveCount(1);
  await expect(page.locator('.story-step')).toHaveCount(3);
  await expect(page.locator('#custom')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('button', { name: 'South', exact: true }).click();
  await expect(page.locator('#custom')).toHaveAttribute('data-position', '2');
  await expect(page.locator('#custom')).toHaveAttribute('data-layout', 'right');
});

test('compile/render errors retain a usable story and recover after correction', async ({ page }) => {
  await ready(page);
  await edit(page, 'Story MDX', '# Broken\n\n<Scrolly>');
  await expect(page.locator('.story-error')).toContainText('Scrolly');
  await expect(page.getByRole('heading', { name: 'Which region sells the most?' })).toBeVisible();
  await expect(page.locator('.story-chart svg').first()).toBeVisible();
  await edit(page, 'Story MDX', 'export function Broken() { throw new Error("A render error") }\n\n<Broken />');
  await expect(page.locator('.story-error')).toContainText('A render error');
  await expect(page.getByRole('heading', { name: 'Which region sells the most?' })).toBeVisible();
  await edit(page, 'Story MDX', '# Recovered\n\n<Scrolly><Step chart={chart}>One state.</Step></Scrolly>');
  await expect(page.getByRole('heading', { name: 'Recovered' })).toBeVisible();
  await expect(page.locator('.story-scrolly')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.story-error')).toHaveCount(0);
});

test('prose edits preserve reading position and drafts survive reload', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'North', exact: true }).click();
  await page.getByLabel('Story reading area').evaluate(node => { node.scrollTop += 180; });
  const scrollBefore = await page.getByLabel('Story reading area').evaluate(node => node.scrollTop);
  expect(scrollBefore).toBeGreaterThan(0);
  await edit(page, 'Story MDX', initialDocument.story.replace('Look at North', 'A closer look at North'));
  await expect(page.locator('.story-document')).toContainText('A closer look at North');
  await expect.poll(() => page.getByLabel('Story reading area').evaluate(node => node.scrollTop)).toBe(scrollBefore);
  await expect(page.getByText('Draft saved on this device')).toBeVisible();
  await page.reload();
  await expect(page.locator('.story-document')).toContainText('A closer look at North');
});

test('project and MDX open wait for Run; save keeps all authoring files', async ({ page }) => {
  await ready(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  const saved = await download;
  const file = await saved.path();
  expect(file).toBeTruthy();
  const { readFile } = await import('node:fs/promises');
  const project = JSON.parse(await readFile(file!, 'utf8'));
  expect(project).toEqual(initialDocument);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await (await chooser).setFiles({ name: 'imported.mdx', mimeType: 'text/plain', buffer: Buffer.from('# Imported story\n\n<Scrolly><Step chart={chart}>Imported.</Step></Scrolly>') });
  await expect(page.getByText('File opened. Press Run to preview its code.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Imported story' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Imported story' })).toBeVisible();
  await expect(page.locator('.story-scrolly')).toHaveAttribute('data-ready', 'true');
});

test('multiple blocks, reading mode, reduced motion and narrow layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page);
  await edit(page, 'Story MDX', initialDocument.story + '\n\n<Scrolly id="second" layout="overlay" theme="dark"><Step id="single" chart={chart}><h2>Second chapter</h2></Step></Scrolly>');
  await expect(page.locator('.story-scrolly[data-ready="true"]')).toHaveCount(2);
  await page.getByRole('button', { name: 'Read story', exact: true }).click();
  await expect(page.getByLabel('Story MDX')).toBeHidden();
  await page.getByLabel('Story reading area').evaluate(node => { node.scrollTop = 600; });
  const position = Number(await page.locator('#sales').getAttribute('data-position'));
  expect(Number.isInteger(position)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Edit story', exact: true }).click();
  await expect(page.getByLabel('Story MDX')).toBeVisible();
});

test('CSV data updates the native chart and MDX exports remain editable source', async ({ page }) => {
  await ready(page);
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import CSV / JSON', exact: true }).click();
  await (await chooser).setFiles({ name: 'sales.csv', mimeType: 'text/csv', buffer: Buffer.from('region,revenue\nNorth,25\nSouth,14') });
  await expect(page.getByLabel('Story data', { exact: true })).toContainText('25');
  await expect(page.locator('.story-chart .vd-bar')).toHaveCount(2);
  const saved = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export MDX', exact: true }).click();
  const file = await (await saved).path();
  const { readFile } = await import('node:fs/promises');
  expect(await readFile(file!, 'utf8')).toBe(initialDocument.story);
});

test('a weather sample project navigates both chapters and reopens the original story', async ({ page }) => {
  await ready(page);
  const file = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await (await file).setFiles({ name: 'weather-sample.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(weatherDocument)) });
  await expect(page.locator('.story-preview-title [role=status]')).toContainText('File opened');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A century, two weather patterns' })).toBeVisible();
  for (const [id, names] of [
    ['weather-trend', ['Whole timeline', 'Recent decades', 'Restore context', 'Cold-day measure']],
    ['weather-detail', ['Decade bars', 'Focus on 2020', 'Compare cold days']],
  ] as const) {
    const chapter = page.locator(`#${id}`);
    await expect(chapter).toHaveAttribute('data-ready', 'true');
    for (const index of [...names.keys(), ...[...names.keys()].reverse()]) {
      await chapter.getByRole('button', { name: names[index], exact: true }).click();
      await expect(chapter).toHaveAttribute('data-position', String(index));
      await expect(chapter.locator('svg').first()).toBeVisible();
      await expect(page.locator('.story-error')).toHaveCount(0);
    }
  }
  await page.getByRole('tab', { name: 'data.json', exact: true }).click();
  await expect(page.getByLabel('Story data', { exact: true })).toContainText('hot_days');
  const original = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await (await original).setFiles({ name: 'original.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(initialDocument)) });
  await expect(page.locator('.story-preview-title [role=status]')).toContainText('File opened');
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Which region sells the most?' })).toBeAttached();
  await expect(page.locator('#sales')).toHaveAttribute('data-ready', 'true');
});

test('entering a step plays to completion while scrolling stays still', async ({ page }) => {
  await ready(page);
  const chapter = page.locator('#sales');
  const reader = page.getByLabel('Story reading area');
  const stop = await reader.evaluate(root => {
    const step = root.querySelector('#north')!;
    const anchor = step.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - root.clientHeight * 0.55;
    root.scrollTo({ top: Math.ceil(anchor) + 2, behavior: 'instant' });
    return root.scrollTop;
  });
  await expect(chapter).toHaveAttribute('data-active-step', '1');
  await expect(chapter).toHaveAttribute('data-playing', 'true');
  await expect.poll(async () => {
    const position = Number(await chapter.getAttribute('data-position'));
    return position > 0 && position < 1;
  }).toBe(true);
  await expect(chapter).toHaveAttribute('data-position', '1');
  await expect(chapter).toHaveAttribute('data-playing', 'false');
  expect(await reader.evaluate(root => root.scrollTop)).toBe(stop);
  await reader.evaluate(root => { root.scrollTop += 60; });
  await expect(chapter).toHaveAttribute('data-position', '1');
  await expect(chapter).toHaveAttribute('data-playing', 'false');
  await reader.evaluate(root => { root.scrollTop = 0; });
  await expect(chapter).toHaveAttribute('data-playing', 'true');
  await expect(chapter).toHaveAttribute('data-position', '0');
  // A rapid change of destination must finish at the latest step.
  await page.getByRole('button', { name: 'North', exact: true }).click();
  await expect(chapter).toHaveAttribute('data-playing', 'true');
  await page.getByRole('button', { name: 'Compare again', exact: true }).click();
  await expect(chapter).toHaveAttribute('data-position', '2');
  await expect(chapter).toHaveAttribute('data-playing', 'false');
});

test('explicit scrub mode retains scroll-controlled transitions', async ({ page }) => {
  await ready(page);
  await edit(page, 'Story MDX', initialDocument.story.replace('<Scrolly id="sales"', '<Scrolly playback="scrub" id="sales"'));
  const chapter = page.locator('#sales');
  await expect(chapter).toHaveAttribute('data-playback', 'scrub');
  await expect(chapter).toHaveAttribute('data-ready', 'true');
  await page.getByLabel('Story reading area').evaluate(root => {
    const anchor = (id: string) => root.querySelector(id)!.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - root.clientHeight * 0.55;
    root.scrollTop = anchor('#overview') + (anchor('#north') - anchor('#overview')) * 0.75;
  });
  await expect.poll(async () => {
    const value = Number(await chapter.getAttribute('data-position'));
    return value > 0.4 && value < 0.7;
  }).toBe(true);
  await expect(chapter).toHaveAttribute('data-playing', 'false');
});
