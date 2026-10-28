import type { StoryDocument } from './document';

// Preserve the illustrative values from scrollylite/examples/weather/data/weather_sample.csv.
// Narrative structure also draws on case_David and case_David_2; these are not observations.
const samples = [
  [1910, 7, 16], [1920, 8, 14], [1930, 9, 13], [1940, 10, 12],
  [1950, 11, 10], [1960, 12, 9], [1970, 13, 8], [1980, 15, 7],
  [1990, 17, 6], [2000, 20, 5], [2010, 24, 4], [2020, 27, 3],
];

export const weatherDocument: StoryDocument = {
  version: 1,
  rows: JSON.stringify(samples.map(([year, hot_days, cold_days]) => ({
    year, decade: `${year}s`, hot_days, cold_days,
    period: year < 1950 ? 'early' : year < 1990 ? 'middle' : 'recent',
  })), null, 2),
  code: `const chart = line(rows)
  .x('year', { label: 'Decade', format: 'd' })
  .y('hot_days', { label: 'Hot days (sample)' })
  .key('year')
  .sort('year');`,
  story: `import { chart } from './chart.js'
import rows from './data.json'
import { bar } from 'visdelta/bar'

export const cold = chart.y('cold_days', { label: 'Cold days (sample)' })
export const bars = bar(rows).x('decade').y('hot_days', { label: 'Hot days (sample)' })

<Hero eyebrow="Weather · An illustrative Melbourne story">
# A century, two weather patterns

Start with the whole timeline. Move closer to recent decades, then look at the same years through a different measure.

**Demonstration data:** these values come from the earlier scrollylite weather sample. They are not verified Melbourne observations. “Hot” and “cold” are sample labels without meteorological thresholds.
</Hero>

<Scrolly id="weather-trend" layout="left" chartStyle="paper" hold={0.45}>
<Step id="weather-overview" title="Whole timeline" chart={chart}>
## Begin with the whole timeline

The sample contains twelve decade records, from 1910 to 2020. Its hot-day values rise from **7 to 27**. Follow the line before narrowing the view.
</Step>
<Step id="weather-recent" title="Recent decades" chart={chart.where({ period: 'recent' })}>
## Move closer to recent decades

Keep the four records from 1990 onward. The chart now concentrates on the part of the timeline we want to inspect. Notice that the axes can rescale when the visible data changes.
</Step>
<Step id="weather-context" title="Restore context" chart={chart}>
## Put those years back in context

Bring all twelve decades back. This return to the overview makes the change of scope explicit, just as the earlier weather cases moved between a selected period and its history.
</Step>
<Step id="weather-cold" title="Cold-day measure" chart={cold}>
## Ask a different question

Keep the years and switch the vertical measure to cold days. In this sample, the values fall from **16 to 3**. Read the axis label: the measure has changed.
</Step>
</Scrolly>

<Chapter>
## From a trend to individual decades

A line makes the sequence easy to follow. A second chapter uses bars to draw attention to individual records. Scroll onward, or use the chapter navigation to revisit a state.
</Chapter>

<Scrolly id="weather-detail" layout="overlay" chartStyle="paper" hold={0.5}>
<Step id="weather-bars" title="Decade bars" chart={bars}>
## Give every decade its own bar

Return to hot days. The twelve bars show the same sample values as the first line chart.
</Step>
<Step id="weather-focus" title="Focus on 2020" chart={bars.highlight({ decade: '2020s' })}>
## Focus without losing the others

The final record has **27 hot days** in this demonstration. Highlighting keeps the remaining decades visible for comparison.
</Step>
<Step id="weather-bar-cold" title="Compare cold days" chart={bars.y('cold_days', { label: 'Cold days (sample)' })}>
## Compare the other measure

Switch to cold days across the same decades. Scroll back to replay the comparison in reverse.
</Step>
</Scrolly>

<Chapter>
## Make this story your own

Edit **story.mdx** to change the narrative, **chart.js** to change the opening chart, and **data.json** to replace the sample. The preview follows your edits.

This demo adapts scrollylite’s weather sample and the overview → focus → comparison structure of case_David and case_David_2. Their station map, daily records and percentile controls are not included here.
</Chapter>`,
};
