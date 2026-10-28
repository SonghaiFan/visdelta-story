import { expect, test, type Page } from '@playwright/test';
import { createStoryStore } from '../components/story/variables';

async function edit(page: Page, source: string) {
  await page.getByLabel('Story MDX', { exact: true }).click();
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('ControlOrMeta+Shift+End');
  await page.keyboard.insertText(source);
}

test('defaults preserve reader choices, changed defaults reset, and invalid bindings fail clearly', () => {
  const store = createStoryStore({ threshold: 95 });
  store.set('threshold', 100);
  store.seed({ threshold: 95 });
  expect(store.get('threshold')).toBe(100);
  store.seed({ threshold: 80 });
  expect(store.get('threshold')).toBe(80);
  expect(() => store.set('threshold', '80')).toThrow('value type');
  const remove = store.declare('threshold', 90, 'duplicate');
  expect(() => store.validate()).toThrow('Duplicate');
  remove();
  store.bind('missing', 'consumer');
  expect(() => store.validate()).toThrow('Unknown');
  expect(createStoryStore({ threshold: 10 }).get('threshold')).toBe(10);
});

const source = `<Story>
# Shared controls

<Var name="threshold" value={95} />
<Range bind="threshold" label="First" />
<Range bind="threshold" label="Second" />
Current: <Value name="threshold" />

<Var name="day" value="2022-02-14" />
<DatePicker bind="day" label="Day" required />
<Value name="day" />
<Var name="measure" value="max" />
<Select bind="measure" label="Measure" options={['max', 'min']} />
<Value name="measure" />

<Story initial={{ threshold: 10 }}>
<Range bind="threshold" label="Independent" />
</Story>
</Story>`;

test('MDX controls and inline values share variables, with isolated scopes and editable defaults', async ({ page }) => {
  await page.goto('story/');
  await expect(page.locator('.story-scrolly')).toHaveAttribute('data-ready', 'true');
  await edit(page, source);
  await expect(page.getByLabel('First', { exact: true })).toHaveValue('95');
  await page.getByLabel('First', { exact: true }).fill('100');
  await expect(page.getByLabel('Second', { exact: true })).toHaveValue('100');
  await expect(page.locator('[data-story-value="threshold"]')).toHaveText('100');
  await expect(page.getByLabel('Independent', { exact: true })).toHaveValue('10');
  await page.getByLabel('Day', { exact: true }).fill('2022-03-01');
  await expect(page.locator('[data-story-value="day"]')).toHaveText('2022-03-01');
  await page.getByLabel('Measure', { exact: true }).selectOption('min');
  await expect(page.locator('[data-story-value="measure"]')).toHaveText('min');
  await edit(page, source.replace('Shared controls', 'Edited prose'));
  await expect(page.getByRole('heading', { name: 'Edited prose' })).toBeVisible();
  await expect(page.getByLabel('First', { exact: true })).toHaveValue('100');
  await edit(page, source.replace('value={95}', 'value={80}'));
  await expect(page.getByLabel('First', { exact: true })).toHaveValue('80');
  await expect(page.getByLabel('Independent', { exact: true })).toHaveValue('10');
  await expect(page.locator('.story-error')).toHaveCount(0);
});

test('unknown and duplicate variables produce author errors and recover', async ({ page }) => {
  await page.goto('story/');
  await expect(page.locator('.story-scrolly')).toHaveAttribute('data-ready', 'true');
  await edit(page, '<Story><Range bind="missing" /></Story>');
  await expect(page.locator('.story-error')).toContainText('Unknown Story variable');
  await edit(page, '<Story><Var name="x" value={1} /><Var name="x" value={2} /></Story>');
  await expect(page.locator('.story-error')).toContainText('Duplicate Story variable');
  await edit(page, source);
  await expect(page.getByLabel('First', { exact: true })).toHaveValue('95');
  await expect(page.locator('.story-error')).toHaveCount(0);
});

test('controls may precede declarations and numeric select values stay numeric', async ({ page }) => {
  await page.goto('story/');
  await expect(page.locator('.story-scrolly')).toHaveAttribute('data-ready', 'true');
  await edit(page, `<Story>
<Select bind="number" label="Numeric choice" options={[{value: 1, label: 'One'}, {value: 2, label: 'Two'}]} />
<Range bind="number" label="Numeric slider" min={0} max={10} />
<Var name="number" value={1} />
<Value name="number" />
</Story>`);
  await page.getByLabel('Numeric choice', { exact: true }).selectOption('2');
  await expect(page.getByLabel('Numeric slider', { exact: true })).toHaveValue('2');
  await expect(page.locator('[data-story-value="number"]')).toHaveText('2');
  await expect(page.locator('.story-error')).toHaveCount(0);
});

test('a non-weather chart.js model binds native views, derived prose and conditions', async ({ page }) => {
  await page.goto('story/');
  await expect(page.locator('.story-scrolly')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('tab', { name: 'chart.js', exact: true }).click();
  await page.getByLabel('Chart code', { exact: true }).click();
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('ControlOrMeta+Shift+End');
  await page.keyboard.insertText(`const chart = bar(rows).x('region').y('revenue');
const model = ({ minimum }) => {
  const selected = chart.where({ revenue: { gte: minimum } });
  return {
    views: { all: chart, selected: { chart: selected, via: [chart.highlight({ region: 'North' })] } },
    values: { count: selected.rows().length, total: selected.rows().reduce((sum, row) => sum + row.revenue, 0) },
    conditions: { hasRows: selected.rows().length > 0, empty: selected.rows().length === 0 }
  };
};`);
  await page.getByRole('tab', { name: 'story.mdx', exact: true }).click();
  const source = `import { model } from './chart.js'

<Story>
<Var name="minimum" value={15} />
<StoryData model={model} bind={['minimum']}>
<Range bind="minimum" label="Minimum revenue" max={30} />

Selected regions: <Value name="count" />; revenue: <Value name="total" />.

<Show when="hasRows">There are matching regions.</Show>
<Show when="empty">No matching regions.</Show>
<Show when="hasRows">
<Scrolly id="generic-model">
<Step id="all-regions" view="all" title="All regions">All regions.</Step>
<Step id="selected-regions" view="selected" title="Selected regions">Selected regions.</Step>
</Scrolly>
</Show>
</StoryData>
</Story>`;
  await edit(page, source);
  await expect(page.locator('[data-story-value="count"]')).toHaveText('1');
  await expect(page.locator('[data-story-value="total"]')).toHaveText('18');
  await page.getByRole('button', { name: 'Selected regions', exact: true }).click();
  await expect(page.locator('#generic-model')).toHaveAttribute('data-position', '1');
  await expect(page.locator('#generic-model .vd-bar')).toHaveCount(1);
  await page.getByLabel('Minimum revenue', { exact: true }).fill('0');
  await expect(page.locator('[data-story-value="count"]')).toHaveText('3');
  await expect(page.locator('[data-story-value="total"]')).toHaveText('39');
  await page.getByRole('button', { name: 'Selected regions', exact: true }).click();
  await expect(page.locator('#generic-model .vd-bar')).toHaveCount(3);
  await page.getByLabel('Minimum revenue', { exact: true }).fill('30');
  await expect(page.locator('[data-story-value="count"]')).toHaveText('0');
  await expect(page.locator('.story-document')).toContainText('No matching regions.');
  await expect(page.locator('.story-document')).not.toContainText('There are matching regions.');
  await expect(page.locator('#generic-model')).toHaveCount(0);
  await page.getByLabel('Minimum revenue', { exact: true }).fill('15');
  await expect(page.locator('[data-story-value="count"]')).toHaveText('1');
  await edit(page, source.replace('view="selected"', 'view="missing"'));
  await expect(page.locator('.story-error')).toContainText('Unknown Story view');
  await edit(page, source.replace('when="empty"', 'when="missing"'));
  await expect(page.locator('.story-error')).toContainText('Unknown Story condition');
  await edit(page, source);
  await expect(page.locator('#generic-model')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.story-error')).toHaveCount(0);
});

test('static StoryData needs no variables and nested data scopes isolate derived values', async ({ page }) => {
  await page.goto('story/');
  await edit(page, `<StoryData values={{ count: 1 }}>
Outer: <Value name="count" />
<StoryData values={{ count: 2 }}>
Inner: <Value name="count" />
</StoryData>
</StoryData>`);
  await expect(page.locator('[data-story-value="count"]')).toHaveText(['1', '2']);
  await expect(page.locator('.story-error')).toHaveCount(0);
});

test('model-only chart.js supports null inputs and derived null values', async ({ page }) => {
  await page.goto('story/');
  await expect(page.locator('.story-scrolly')).toHaveAttribute('data-ready', 'true');
  await page.getByRole('tab', { name: 'chart.js', exact: true }).click();
  await page.getByLabel('Chart code', { exact: true }).click();
  await page.keyboard.press('ControlOrMeta+Home');
  await page.keyboard.press('ControlOrMeta+Shift+End');
  await page.keyboard.insertText(`const model = ({ optional }) => ({
    views: { overview: bar(rows).x('region').y('revenue') },
    values: { result: optional }, conditions: { available: true }
  });`);
  await page.getByRole('tab', { name: 'story.mdx', exact: true }).click();
  await edit(page, `import { model } from './chart.js'

<Story>
<Var name="optional" value={null} />
<StoryData model={model} bind={['optional']}>
Result: <Value name="result" />
<Scrolly id="model-only"><Step view="overview">A native chart.</Step></Scrolly>
</StoryData>
</Story>`);
  await expect(page.locator('#model-only')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#model-only .vd-bar')).toHaveCount(3);
  await expect(page.locator('[data-story-value="result"]')).toHaveText('—');
  await expect(page.locator('.story-error')).toHaveCount(0);
});
