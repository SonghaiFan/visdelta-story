> Historical mapping of the precursor case and its first reconstruction. The
> shipped demo is now one [seven-step data story](weather-analysis.md); the station
> map, 1910-only comparison, and all-days/annual histograms are no longer part of
> its default narrative. Legacy components remain for saved documents.

# Weather case study reconstruction

This Story reconstructs the active narrative in `case_David_2`, informed by its
first version `case_David`. It preserves the analytical questions and chart
populations. It is not a pixel-for-pixel copy of the old D3 renderers.

Open Studio → Story → **Full case study**, or `/story/?example=weather-case`.
**Weather demo** opens a shorter five-scene introduction at
`/story/?example=weather`; its MDX contains prose and simple component tags.
In the full case, daily chart states and narrative are authored in editable MDX (`components/story/weather-case.ts`). `chart.js`
authors the station-location chart; `data.json` contains the station catalogue.
The daily archive is lazy-loaded separately, avoiding an 82,033-row editor buffer
and local-storage draft.

## What story did the original tell?

The opening asked about extreme weather in Australia, then personalized the
question to a station, date, maximum/minimum measure and percentile threshold.
The active story followed one year back to 1910, focused a small date window,
restored historical context, selected extreme days, rearranged those same days,
and finally changed grain from individual days to a temperature histogram.

The old HTML contains placeholder paragraphs and inactive/commented layout
examples. The implemented `stepRenderTrigger()` switch and renderer transforms,
rather than the placeholder prose, define this reconstruction's reading order.

| Original step | Question / population | Original chart | Story / native VisDelta state |
| --- | --- | --- | --- |
| Intro, station chapter | Where is the selected station? | Australia basemap and station markers | Keyed point chart of all 45 longitude/latitude positions; selected location highlighted |
| 2 | What did the selected year look like? | Daily line | `line`, filtered to selected year |
| 3 | How does it compare with 1910? | Two yearly lines | Add 1910, `breakdown('year')` |
| 4 | What happens within ±7 ordinal days? | Zoomed comparison lines | Filter the two-year population to the window |
| 5 | What is the historical context? | All years' window lines | Restore all available years in the same window |
| 6 | What are the individual observations? | Lines replaced by dots | Keyed point chart, same x/y axes and population |
| 7 | Which days reach the percentile threshold? | Filtered dots | `where({ percentile: { gte: threshold } })` |
| 8 | When did the extreme days occur? | Custom year dodge plot | Keyed point stacks by year, same selected date identities |
| 9 | How warm were those extreme days? | Custom temperature dodge plot | Remap the same keyed points to temperature |
| 10 | How does that subset fit the whole population? | All window days in temperature dodge plot | Restore all window points |
| 11 | How do individual days build a distribution? | One rectangle per day in 0.5°C stacks | Unit bar layout, grouped into 0.5°C bins |
| 12 | What are the bin counts? | Aggregated count histogram | Native bar `rollup({ op: 'sum' })` on a constant `one` measure |
| 13 | What does the selected year's distribution look like? | Histogram of the selected year's days | Replace window population with all recorded days in the selected year |
| 14–15 / inactive sections | No additional implemented analytical state | No-op / placeholder | Omitted |

## What is actually in the archive?

`data/weather/README.md` records the original file hash, schema,
coverage and source labels. There are 82,033 city-level Melbourne records, from
1910-01-01 through April 2022. There are no duplicate date/measure pairs and no
empty temperature values. No values are filled, interpolated or sampled down.

The separate 45-location catalogue is not a 45-station observation dataset. A
non-Melbourne selection changes the location highlight and displays an explicit
missing-data state; it never reuses Melbourne temperatures under another name.
The original temperature file does not carry a station identifier, so the Story
does not claim all records are measurements from catalogue station 086338.

The `acorn` / `raw` source labels and supplied `temp_percentile` ranks are
preserved. The original preparation script, rank reference population and full
upstream provenance have not been recovered. The threshold operates on those
archived ranks, not newly calculated station climatology. Daily minimum with a
high percentile selects unusually **warm minima**, not cold extremes.

## Meaningful differences and limits

- Station locations use a longitude/latitude plot, without the old basemap.
- Keyed point stacks replace custom pixel-space dodge code. Slots are computed
  for the full window, so selecting a subset leaves gaps rather than packing it
  again. Restoring all observations fills those same slots.
- Lines and scatter plots keep the original −10 to 50°C vertical domain.
- Orange / blue / grey explicitly distinguish selected year, 1910 and other years.
- Day-of-year alignment is inherited, including the leap-year offset after
  February. January/December windows wrap over a 366-position ordinal cycle;
  a non-leap year has no observation at ordinal position 366.
- The 2022 year is partial. Record counts and missing selected dates are shown.
- Half-degree bins are left-inclusive and right-exclusive. Unit counts and
  aggregate bar counts conserve the same source observations. Bins with no
  observations have no bar. The full-year and seasonal-window populations have
  different seasonal coverage and sample sizes, so raw counts are not rates.
- Entering a narrative step starts its transition; stopping the scroll does not
  stop playback. Reversing or skipping steps retargets the animation from its
  current frame. Reduced-motion readers see immediate state changes.
- Large chapters prepare when they enter the reading area. `Step view`
  selections retain explicit one-axis-at-a-time native waypoints for point remaps.
- Same-family stages use native VisDelta `transition` legs. Story
  dissolves independently rendered endpoints at chart-family boundaries.
  It does not claim a correspondence-preserving point-to-unit or unit-to-bar
  morph that Core does not implement.
- Controls bind shared Story variables declared with `Var` in MDX. Edit their
  values to save different defaults. `Value` renders selections and `Value`
  renders derived archive counts and measurements. Markdown and declarative
  content conditions replace the earlier hooks and event handlers. Exported MDX depends on companion
  Studio modules and the archive; it is not a standalone website export.

## Verification

`tests/weather-story.spec.ts` verifies native state population identities,
per-bin histogram counts, all authored steps forward and backward, real mark
counts, metric/date/threshold changes, unavailable stations, fetch retry and narrow
reading. The existing Story tests cover authoring and draft restoration.

Both weather examples now supply generic StoryData models: Step view selects
native states, Value renders derived facts, and Show selects named conditions.
Weather adapters retain data-source preparation; other datasets can supply the
same views/values/conditions contract through chart.js model functions.
