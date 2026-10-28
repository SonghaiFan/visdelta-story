'use client';

import { useMemo, type ReactNode } from 'react';
import type { line } from 'visdelta/line';
import { useStoryVariables } from './bindings';
import { StoryData } from './story-model';
import { useWeatherArchive } from './weather-archive';
import { prepareWeather, seasonalDay, type WeatherSettings } from './weather-data';
import { makeWeatherNarrativeCharts } from './weather-narrative-charts';
import { initialSettings } from './weather-story';

export function WeatherNarrative({ chart, children }: { chart?: ReturnType<typeof line>; children?: ReactNode }) {
  const bound = useStoryVariables(['station', 'date', 'metric', 'threshold']);
  if (!bound) return null;
  return <NarrativeSession settings={initialSettings(bound as unknown as WeatherSettings)} chart={chart}>{children}</NarrativeSession>;
}
function NarrativeSession({ settings, chart, children }: { settings: WeatherSettings; chart?: ReturnType<typeof line>; children?: ReactNode }) {
  const archive = useWeatherArchive();
  const { station, date, metric, threshold } = settings;
  const data = useMemo(() => archive.records && station === 'Melbourne' ? prepareWeather(archive.records, { station, date, metric, threshold: 0 }, true) : null, [archive.records, station, date, metric]);
  const base = useMemo(() => data ? makeWeatherNarrativeCharts(data, chart) : null, [data, chart]);
  const views = useMemo(() => base?.select(threshold), [base, threshold]);
  const selected = useMemo(() => views?.extreme.rows() ?? [], [views]);
  const center = seasonalDay(date) ?? seasonalDay('2001-02-28')!;
  const label = (offset: number) => new Date(Date.UTC(2001, 0, ((center - 1 + offset + 365) % 365) + 1)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const atLeast = data?.observation ? data.nearby.filter(row => row.temperature >= data.observation!.temperature).length : null;
  const values = {
    year: data?.year ?? null, temperature: data?.observation?.temperature ?? null,
    recordCount: data?.selectedYear.length ?? null, windowCount: data?.nearby.length ?? null,
    windowYears: data ? new Set(data.nearby.map(row => row.year)).size : null,
    windowStart: label(-7), windowEnd: label(7), extremeCount: selected.length,
    selectedShare: data?.nearby.length ? (100 * selected.length / data.nearby.length).toFixed(1) : '0.0',
    atLeastCount: atLeast, observationPercentile: data?.observation?.percentile ?? null,
    selectedMin: selected.length ? Math.min(...selected.map(row => Number(row.temperature))) : null,
    selectedMax: selected.length ? Math.max(...selected.map(row => Number(row.temperature))) : null,
    measureLabel: metric === 'tmax' ? 'Daily maximum' : 'Daily minimum',
    metricLastDate: data?.metricLastDate ?? null,
  };
  const conditions = { ready: !!data && !!views, observation: !!data?.observation,
    missingObservation: !!data && !data.observation, empty: !!data && !selected.length,
    hasSelected: !!selected.length, minimum: metric === 'tmin', maximum: metric === 'tmax',
    leapDay: date.endsWith('02-29'), missingStation: station !== 'Melbourne' };
  return <>
    {archive.error && <p role="alert">{archive.error} <button onClick={archive.retry}>Retry weather archive</button></p>}
    {!archive.records && !archive.error && <p role="status">Loading archived observations…</p>}
    <StoryData views={views} values={values} conditions={conditions}>{children}</StoryData>
  </>;
}
