import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { weatherDemoDocument } from '../components/story/weather-demo';
import { weatherCaseDocument } from '../components/story/weather-case';
import { makeWeatherNarrativeCharts } from '../components/story/weather-narrative-charts';
import { prepareWeather, type WeatherObservation } from '../components/story/weather-data';

const source = JSON.parse(readFileSync('data/weather/melbourne.json', 'utf8'));
const records: WeatherObservation[] = source.rows.map(([date, metric, temperature, percentile, provenance, day]: [string, string, number, number, string, number]) => ({ id: `${date}:${metric}`, date, metric, temperature, percentile, source: provenance, day_of_year: day, year: Number(date.slice(0, 4)) }));
const settings = { station: 'Melbourne', date: '2009-02-07', metric: 'tmax', threshold: 95 };
const titles = ['One year', 'Same season', 'Choose the tail', 'Keep their dates', 'Read their temperatures', 'One dot per day', 'The distribution'];
async function weather(page: Page, suffix = '') {
  await page.goto(`story/?example=weather${suffix}`);
  await expect(page.getByRole('heading', { name: 'What makes a day exceptional?' })).toBeVisible();
  await expect(page.locator('#weather-story')).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
}
async function edit(page: Page, label: string, value: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('ControlOrMeta+Shift+End');
  await page.keyboard.insertText(value);
}

test('the unified story claims agree with independently counted archive rows', () => {
  expect(records).toHaveLength(82033);
  expect(new Set(records.map(row => row.id)).size).toBe(82033);
  const maxima = records.filter(row => row.metric === 'tmax');
  expect(maxima).toHaveLength(41016);
  expect(Math.max(...maxima.map(row => row.temperature))).toBe(45.9);
  expect(maxima.filter(row => row.temperature === 45.9).map(row => row.date)).toEqual(['2009-02-07']);
  expect(maxima.filter(row => row.year === 2009 && row.temperature >= 40).map(row => row.date)).toEqual(['2009-01-20', '2009-01-28', '2009-01-29', '2009-01-30', '2009-02-07']);
  expect(maxima.find(row => row.date === '2009-02-08')?.temperature).toBe(20.9);
  const seasonal = maxima.filter(row => row.date.slice(5) >= '01-31' && row.date.slice(5) <= '02-14');
  const selected = seasonal.filter(row => row.percentile >= 95);
  expect(seasonal).toHaveLength(1695);
  expect(new Set(seasonal.map(row => row.year)).size).toBe(113);
  expect(selected).toHaveLength(118);
  const top = seasonal.filter(row => row.percentile >= 100);
  expect(top).toHaveLength(21);
  expect([Math.min(...top.map(row => row.temperature)), Math.max(...top.map(row => row.temperature))]).toEqual([39.5, 45.9]);
  const data = prepareWeather(records, settings, true);
  expect(data.selectedYear).toHaveLength(365);
  expect(data.nearby.map(row => row.id)).toEqual(seasonal.map(row => row.id));
  const views = makeWeatherNarrativeCharts(data).select(95);
  const expectedIds = selected.map(row => row.id).sort();
  expect(views.extreme.rows().map(row => row.id).sort()).toEqual(expectedIds);
  expect(views.byYear.chart.rows().map(row => row.id).sort()).toEqual(expectedIds);
  expect(views.byTemperature.chart.rows().map(row => row.id).sort()).toEqual(expectedIds);
  expect(views.binned.rows().map(row => row.id).sort()).toEqual(expectedIds);
  const expectedBins = new Map<number, number>();
  selected.forEach(row => { const bin = Math.floor(row.temperature * 2) / 2; expectedBins.set(bin, (expectedBins.get(bin) ?? 0) + 1); });
  expect(views.histogram.rows().map(row => [row.bin, row.one])).toEqual([...expectedBins].sort((a, b) => a[0] - b[0]));
  expect(views.histogram.rows().reduce((sum, row) => sum + Number(row.one), 0)).toBe(118);
  const domain = (views.histogram.toSpec() as unknown as { encoding: { x: { domain: number[] } } }).encoding.x.domain;
  expect(domain).toContain(41.5);
  expect(views.histogram.rows().some(row => row.bin === 41.5)).toBe(false);
  expect(domain.every((value, index) => !index || value - domain[index - 1] === 0.5)).toBe(true);
  expect(makeWeatherNarrativeCharts(data).select(100).histogram.rows().reduce((sum, row) => sum + Number(row.one), 0)).toBe(21);
  expect(weatherCaseDocument).toBe(weatherDemoDocument);
  expect(weatherDemoDocument.story).not.toMatch(/export function|useState|useMemo|onChange|=>|const /);
  expect(weatherDemoDocument.story.match(/<Step /g)).toHaveLength(7);
});

test('common-calendar comparisons align leap years, wrap New Year and retain real gaps', () => {
  const march = prepareWeather(records, { ...settings, date: '2020-03-01' }, true);
  expect(march.nearby.some(row => row.date.endsWith('02-29'))).toBe(false);
  expect(march.nearby.filter(row => row.year === 2020)).toHaveLength(15);
  expect(march.nearby.filter(row => row.year === 2019)).toHaveLength(15);
  const leap = prepareWeather(records, { ...settings, date: '2020-02-29' }, true);
  expect(leap.observation?.date).toBe('2020-02-29');
  expect(leap.nearby.map(row => row.id)).toEqual(prepareWeather(records, { ...settings, date: '2020-02-28' }, true).nearby.map(row => row.id));
  expect(march.selectedYear).toHaveLength(366);
  expect(makeWeatherNarrativeCharts(march).year.rows()).toHaveLength(366);
  const january = prepareWeather(records, { ...settings, date: '2020-01-01' }, true);
  expect(january.nearby.some(row => row.date.slice(5) === '12-31')).toBe(true);
  expect(january.nearby.some(row => row.date.slice(5) === '01-08')).toBe(true);
  expect(prepareWeather(records, { ...settings, date: '2021-07-08' }, true).observation).toBeUndefined();
  expect(prepareWeather(records, { ...settings, date: '2021-07-08' }, true).selectedYear).toHaveLength(364);
});

test('one entry replaces both demos and the old URL opens the same narrative', async ({ page }) => {
  await weather(page, '-case');
  await expect(page.getByRole('button', { name: 'Weather story', exact: true })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Full case study', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('weather-selection')).toContainText('118 at percentile ≥ 95');
  await expect(page.getByTestId('weather-day')).toContainText('45.9°C');
  await expect(page.locator('.story-step')).toHaveCount(7);
});

test('all seven narrative views play forward and backward with conserved selected marks', async ({ page }) => {
  test.setTimeout(60000);
  await weather(page);
  const chapter = page.locator('#weather-story');
  for (const index of [...titles.keys(), ...[...titles.keys()].reverse()]) {
    await chapter.getByRole('button', { name: titles[index], exact: true }).click();
    await expect(chapter).toHaveAttribute('data-position', String(index));
    expect(await chapter.locator('svg').evaluateAll(nodes => nodes.some(node => /(?:NaN|Infinity)/.test(node.innerHTML)))).toBe(false);
    await expect(page.locator('.story-error')).toHaveCount(0);
    if (index === 6) await page.screenshot({ path: test.info().outputPath('weather-story-histogram.png') });
  }
  await chapter.getByRole('button', { name: 'Keep their dates', exact: true }).click();
  await expect(chapter).toHaveAttribute('data-position', '3');
  await expect(chapter.locator('circle.vd-point')).toHaveCount(118);
  await page.reload();
  await expect(chapter).toHaveAttribute('data-position', '3');
  await expect(chapter.locator('circle.vd-point')).toHaveCount(118);
  await page.screenshot({ path: test.info().outputPath('weather-story-desktop.png') });
});

test('rank slider updates the quoted count, share and the actual selected population', async ({ page }) => {
  await weather(page);
  const chapter = page.locator('#weather-story');
  await chapter.getByRole('button', { name: 'Choose the tail', exact: true }).click();
  await page.getByLabel('Extreme weather percentile', { exact: true }).fill('100');
  await expect(page.getByTestId('weather-selection')).toContainText('21 at percentile ≥ 100');
  await expect(page.locator('[data-story-value="selectedShare"]')).toHaveText('1.2');
  await chapter.getByRole('button', { name: 'Keep their dates', exact: true }).click();
  await expect(chapter).toHaveAttribute('data-position', '3');
  await expect(chapter.locator('circle.vd-point')).toHaveCount(21);
});

test('prose edits preserve reader choices and chart.js changes the visible native chart', async ({ page }) => {
  await weather(page);
  const chapter = page.locator('#weather-story');
  await chapter.getByRole('button', { name: 'Choose the tail', exact: true }).click();
  await page.getByLabel('Extreme weather percentile', { exact: true }).fill('100');
  await edit(page, 'Story MDX', weatherDemoDocument.story.replace('What makes a day exceptional?', 'A rewritten weather story'));
  await expect(page.getByRole('heading', { name: 'A rewritten weather story' })).toBeAttached();
  await expect(page.getByLabel('Extreme weather percentile', { exact: true })).toHaveValue('100');
  await page.getByRole('tab', { name: 'chart.js', exact: true }).click();
  await edit(page, 'Chart code', weatherDemoDocument.code.replace(".breakdown('year')", ".strokeWidth(6).breakdown('year')"));
  await chapter.getByRole('button', { name: 'One year', exact: true }).click();
  await expect(chapter).toHaveAttribute('data-position', '0');
  await expect.poll(() => chapter.locator('path.vd-line').first().evaluate(node => parseFloat(getComputedStyle(node).strokeWidth))).toBe(6);
  await expect(page.locator('.story-error')).toHaveCount(0);
});

test('archive retry, missing observations, warm nights and narrow reading remain honest', async ({ page }) => {
  await page.route('**/data/weather/melbourne.json', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await page.goto('story/?example=weather');
  await expect(page.getByRole('button', { name: 'Retry weather archive' })).toBeVisible();
  await page.unroute('**/data/weather/melbourne.json');
  await page.getByRole('button', { name: 'Retry weather archive' }).click();
  await expect(page.locator('#weather-story')).toHaveAttribute('data-ready', 'true');
  await page.getByText('Explore another day or measure', { exact: true }).click();
  await page.getByLabel('Weather date', { exact: true }).fill('2021-07-08');
  await expect(page.getByText('No observation is available for this date and measure.', { exact: false })).toBeAttached();
  await page.getByLabel('Weather measure', { exact: true }).selectOption('tmin');
  await expect(page.getByText('warm nights', { exact: true })).toBeAttached();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Read story', exact: true }).click();
  await page.locator('#weather-story').getByRole('button', { name: 'Choose the tail', exact: true }).click();
  await expect(page.getByLabel('Extreme weather percentile', { exact: true })).toBeVisible();
  await expect(page.locator('#weather-story')).toHaveAttribute('data-position', '2');
  await expect(page.locator('#weather-story')).toHaveAttribute('data-playing', 'false');
  expect(await page.getByLabel('Story reading area').evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('weather-story-mobile.png') });
  await expect(page.locator('.story-error')).toHaveCount(0);
});
