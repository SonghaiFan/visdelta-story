import { initialDocument, type StoryDocument } from './document';
import { weatherDemoDocument } from './weather-demo';

const energyDocument: StoryDocument = {
  version: 1,
  rows: JSON.stringify([18, 16, 15, 15, 18, 26, 43, 62, 74, 68, 57, 52, 49, 48, 51, 59, 73, 91, 96, 88, 72, 54, 37, 25].map((demand, hour) => ({ hour, demand })), null, 2),
  code: `// Illustrative hourly demand, not measured electricity consumption.
const model = ({ threshold }) => {
  const overview = line(rows).key('hour')
    .x('hour', { label: 'Hour of day', format: 'd' })
    .y('demand', { label: 'Illustrative demand', domain: [0, 100] });
  const selected = bar(rows).key('hour')
    .where({ demand: { gte: threshold } })
    .x('hour', { label: 'Hour of day', format: 'd' })
    .y('demand', { label: 'Illustrative demand', domain: [0, 100] });
  return {
    views: { overview, selected },
    values: { count: selected.rows().length },
    conditions: { matches: selected.rows().length > 0, empty: selected.rows().length === 0 },
  };
};`,
  story: `import { model } from './chart.js'

<Story>
<Var name="threshold" value={70} />
<StoryData model={model} bind={['threshold']}>
<Hero eyebrow="Interactive story · illustrative data">

# When does demand peak?

This invented 24-hour series has a morning rise and a larger evening peak.
It demonstrates linked controls; it is not a measured energy dataset.

</Hero>

<Controls>
<Range bind="threshold" label="Demand cutoff" min={0} max={100} />
</Controls>

**<Value name="count" /> of 24 hours** meet the current cutoff of <Value name="threshold" />.

<Scrolly id="energy">
<Step id="energy-day" view="overview" title="A whole day">

## Start with the daily shape

A line connects the hours in order. The evening peak rises above the morning one.

</Step>
<Step id="energy-peaks" view="selected" title="Hours above the cutoff">

## Decide which hours matter

The bars show the same data filtered by your cutoff. Move the slider to change
which hours qualify; the prose reads the native chart's filtered rows.

<Show when="empty">No hours meet this cutoff.</Show>

</Step>
</Scrolly>
</StoryData>
</Story>`,
};

export interface StoryExample { id: string; title: string; description: string; source: string; document: StoryDocument; }
export const storyExamples: StoryExample[] = [
  { id: 'sales', title: 'Regional sales', description: 'An overview, a focus, and a return to context.', source: 'Starter · illustrative data', document: initialDocument },
  { id: 'energy', title: 'Energy demand', description: 'Link a cutoff, inline counts, and native chart views.', source: 'Interactive · illustrative data', document: energyDocument },
  { id: 'weather', title: 'Weather story', description: 'Put one exceptional day in its seasonal context.', source: 'Case study · archived observations', document: weatherDemoDocument },
];
export const findStoryExample = (id: string | null) => storyExamples.find(item => item.id === (id === 'weather-case' ? 'weather' : id));

const sameDocument = (a: StoryDocument, b: StoryDocument) => a.story === b.story && a.code === b.code && a.rows === b.rows;
/** Refresh known untouched examples; never replace an edited authoring draft. */
export function refreshExampleDraft(id: string | null, draft: StoryDocument, baseline?: StoryDocument): StoryDocument {
  const example = findStoryExample(id);
  if (!example) return draft;
  if (baseline && sameDocument(draft, baseline)) return example.document;
  if (sameDocument(draft, example.document)) return example.document;
  if (!baseline && example.id === 'weather') {
    const previous = { ...example.document, story: example.document.story.replace('<Sticky>\n', '').replace('</Sticky>\n', '') };
    if (sameDocument(draft, previous)) return example.document;
  }
  return draft;
}
