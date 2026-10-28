export interface StoryDocument {
  version: 1;
  story: string;
  code: string;
  rows: string;
}

export const initialDocument: StoryDocument = {
  version: 1,
  rows: JSON.stringify([
    { region: 'North', revenue: 18 },
    { region: 'South', revenue: 12 },
    { region: 'West', revenue: 9 },
  ], null, 2),
  code: `const chart = bar(rows)\n  .x('region')\n  .y('revenue');`,
  story: `import { chart } from './chart.js'

export const title = 'Which region sells the most?'

<Hero eyebrow="A small data story">

# {title}

Compare the whole picture, then take a closer look at North.

</Hero>

<Scrolly id="sales" layout="left" hold={0.45}>

<Step id="overview" chart={chart} title="Overview">

## Compare all three regions

Each bar shows one region's revenue.

</Step>

<Step id="north" chart={chart.highlight({ region: 'North' })} title="North">

## Look at North

North has the highest revenue. The other regions remain visible.

</Step>

<Step id="compare" chart={chart} title="Compare again">

## Return to the whole picture

Scroll back to explore the same transition in reverse.

</Step>

</Scrolly>

<Chapter>

## The whole story

A highlight changes our attention, without removing any region from the data.

| Region | Revenue |
| --- | ---: |
| North | 18 |
| South | 12 |
| West | 9 |

</Chapter>`,
};

export function parseDocument(value: unknown): StoryDocument {
  if (!value || typeof value !== 'object') throw new Error('Choose a VisDelta Story project (.json) or an MDX file.');
  const doc = value as Record<string, unknown>;
  if (doc.version !== 1 || typeof doc.story !== 'string' || typeof doc.code !== 'string' || typeof doc.rows !== 'string') {
    throw new Error('This is not a supported VisDelta Story project.');
  }
  return { version: 1, story: doc.story, code: doc.code, rows: doc.rows };
}

export const STORY_STORAGE_KEY = 'visdelta-story-draft-v1';
