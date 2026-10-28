import type { StoryDocument } from './document';

/** One evidence-led narrative replaces the short demo and the chart-by-chart case. */
export const weatherDemoDocument: StoryDocument = {
  version: 1,
  rows: JSON.stringify([{ station: 'Melbourne', date: '2009-02-07', metric: 'tmax', threshold: 95 }], null, 2),
  code: `// One reusable native chart; the archive supplies the observations.
const chart = line()
  .x('day_of_year', { label: 'Day of selected year', format: 'd' })
  .y('temperature', { label: 'Temperature (°C)', domain: [-5, 50] })
  .breakdown('year')
  .color('series', {
    domain: ['Selected year', 'Other years'],
    range: ['#dc532d', '#b9bec4'],
  });`,
  story: `import { WeatherNarrative, WeatherArchiveLink, measureOptions } from './weather.js'
import { chart } from './chart.js'
import settings from './data.json'

<Story initial={settings[0]}>
<WeatherNarrative chart={chart}>
<Hero eyebrow="Melbourne · reading a weather archive">

# What makes a day exceptional?

On 7 February 2009, this archive records a daily maximum of **45.9°C**—its highest among **41,016 daily maxima**. The next day's maximum was **20.9°C**, 25°C lower. A single peak and the days around it tell different parts of the story.

We will put one day beside the same season in other years, choose a group of unusually warm days, and follow those same observations into a distribution.

</Hero>

<Sticky>
<details>
<summary>Explore another day or measure</summary>
<Controls>
<DatePicker bind="date" label="Weather date" min="1910-01-01" max="2022-04-20" required />
<Select bind="metric" label="Weather measure" options={measureOptions} />
</Controls>

The opening fact stays about 2009. The charts and numbers below follow your selection. This file contains Melbourne observations only.

</details>
</Sticky>

<Show when="missingStation">

No archived observations are available for <Value name="station" />. This file contains Melbourne only; no other city's values are substituted.

</Show>
<Show when="ready">
<p className="weather-selection" data-testid="weather-selection"><Value name="date" /> · <Value name="measureLabel" /> · <Value name="windowCount" /> seasonal observations · <Value name="extremeCount" /> at percentile ≥ <Value name="threshold" /></p>
<Show when="observation">
<p data-testid="weather-day">Selected day: <Value name="temperature" />°C, archived percentile <Value name="observationPercentile" />.</p>
</Show>
<Show when="missingObservation">

No observation is available for this date and measure. The surrounding archive is still shown; a missing value is not zero.

</Show>
<Show when="minimum">

You are exploring daily minima. A high rank here selects **warm nights**, not cold extremes.

</Show>
<Show when="leapDay">

For a 29 February selection, the seasonal comparison is centred on 28 February. Leap-day records are excluded from seasonal windows.

</Show>

<Scrolly id="weather-story" chartStyle="paper" lazy>
<Step id="weather-year" view="year" title="One year">

## First, see the year around it

The selected year is <Value name="year" />, with <Value name="recordCount" /> available daily observations. The line makes a hot spell visible in the context of the rest of that year.

At the starting settings, 2009 has **five days at or above 40°C**. Three came in a row on 28–30 January: 43.2, 44.1 and 44.9°C. The 45.9°C peak came on 7 February, followed by a 20.9°C daily maximum the next day.

The year contains a sequence, not just a record. Choose another date above to explore it. Partial years and missing dates stay incomplete.

</Step>
<Step id="weather-history" view="history" title="Same season">

## Compare like with like

A summer day should not be judged against a winter day. Keep **<Value name="windowStart" /> to <Value name="windowEnd" />** across the available years: <Value name="windowCount" /> observations from <Value name="windowYears" /> years.

At the starting settings, this window starts on 31 January and excludes the 28–30 January run of hot days. It is a seasonal reference, not a measurement of the whole hot spell.

Each dot is a recorded day. Orange identifies the selected year. The temperature scale stays the same; the horizontal axis now aligns dates to a common seasonal calendar.

<Show when="observation">

Of these observations, **<Value name="atLeastCount" />** reached at least the selected day's <Value name="temperature" />°C. That is a count in this archive, not a forecast or a return period.

</Show>
</Step>
<Step id="weather-threshold" view="extreme" title="Choose the tail">

## Define what you mean by unusual

<Range bind="threshold" label="Extreme weather percentile" />

At an archived percentile of at least **<Value name="threshold" />**, we retain **<Value name="extremeCount" /> of <Value name="windowCount" /> days—<Value name="selectedShare" />%** of this seasonal window.

At the starting settings, 95 keeps 118 days, about 7%. Raising it to 100 still keeps 21 days, spanning 39.5–45.9°C. The integer rank label is not a temperature cutoff, and it does not isolate the single hottest day.

The archive does not document the ranks' reference population. Read the observed count; do not interpret 95 as exactly the warmest 5% of this window.

<Show when="empty">No days meet this selection.</Show>
</Step>
<Step id="weather-year-stack" view="byYear" title="Keep their dates">

## Which years contain those days?

The same <Value name="extremeCount" /> selected observations move to their recorded years. Only their positions change.

This lets us locate the days in time. It does not establish a warming trend: the final year is partial, the archive changes source labels, and the supplied rank baseline is unknown. Vertical slots preserve each day's place in the full seasonal window; gaps are not missing temperatures.

</Step>
<Step id="weather-temperature-stack" view="byTemperature" title="Read their temperatures">

## A rank still covers many temperatures

Now arrange those same days by temperature. No observations have been added or removed.

<Show when="hasSelected">

The current selection spans **<Value name="selectedMin" /> to <Value name="selectedMax" />°C**. A high rank describes a group; the actual temperatures tell us how broad that group is.

</Show>
</Step>
<Step id="weather-bins" view="binned" title="One dot per day">

## Make the counting visible

Stack the selected days into **0.5°C bins**. Each dot still represents one observation. A bin labelled 40°C contains values from 40°C up to, but not including, 40.5°C.

We are counting days, not adding their temperatures. There are still <Value name="extremeCount" /> selected observations.

</Step>
<Step id="weather-distribution" view="histogram" title="The distribution">

## One day at the edge of a distribution

Replace each stack with a bar. The bars count the **same <Value name="extremeCount" /> days**, using the same bins and selection. Their total must equal the number of dots you just saw. Empty half-degree bins retain their place on the axis; no artificial days are added.

At the starting settings, only one seasonal-window observation reaches 45.9°C. The wider group selected by rank includes many cooler days. Both statements can be true: a single day can sit at the edge of a distribution while sharing a rank label with others.

A temperature, an archived rank, and a seasonal comparison answer different questions. Change the date, measure or threshold to see which answer changes.

</Step>
</Scrolly>
</Show>

<details>
<summary>What this archive can—and cannot—tell us</summary>

The source is the earlier case study's Melbourne temperature file: **82,033 records**, from 1 January 1910 to April 2022. Daily maxima end on 19 April; minima end on 20 April. Both measures are missing 8 July 2021. Neither gap nor the partial final year is filled.

Records are keyed by date and measure; no duplicates were found. The file labels 80,354 records “acorn” and 1,679 “raw”. Their preparation and the percentile reference population are unavailable here. The 45.9°C opening is a statement about this file, not a claim about an independently verified station record or a climate trend.

Seasonal windows use a common 365-day month/day calendar, wrapping around New Year. 29 February is excluded from these comparisons; a selection on that date centres the window on 28 February. The annual line retains the actual year's daily observations. Window counts use only available records.

<WeatherArchiveLink>Inspect the archived observations</WeatherArchiveLink>

</details>
</WeatherNarrative>
</Story>`,
};
