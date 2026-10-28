'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { point } from 'visdelta/point';
import { useStoryVariable } from './bindings';
import { StoryData } from './story-model';
import { Step } from './story-components';
import { useWeatherArchive, weatherArchiveHref } from './weather-archive';
import { prepareWeather } from './weather-data';
import { makeWeatherCaseCharts } from './weather-case-charts';
import { initialSettings } from './weather-story';

type StationChart = ReturnType<typeof point>;
type DailyCharts = ReturnType<typeof makeWeatherCaseCharts>;
type CaseData = ReturnType<typeof prepareWeather>;
interface CaseContext {
  stationChart: StationChart;
  charts: DailyCharts | null;
  data: CaseData | null;
  archive: ReturnType<typeof useWeatherArchive>;
  facts: Record<string, string | number | null>;
  station: string;
  date: string;
  extremeCount: number;
}
const Context = createContext<CaseContext | null>(null);
function useCase() {
  const value = useContext(Context);
  if (!value) throw new Error('Place weather case components inside WeatherCase.');
  return value;
}

/** The full case shares the same four Story variables as the short example. */
export function WeatherCase({ chart, children }: { chart: StationChart; children?: ReactNode }) {
  const [station] = useStoryVariable('station');
  const [date] = useStoryVariable('date');
  const [metric] = useStoryVariable('metric');
  const [threshold] = useStoryVariable('threshold');
  if ([station, date, metric, threshold].some(value => value === undefined)) return null;
  const settings = initialSettings({ station, date, metric, threshold } as Parameters<typeof initialSettings>[0]);
  return <CaseSession chart={chart} settings={settings}>{children}</CaseSession>;
}
function CaseSession({ chart, settings, children }: { chart: StationChart; settings: ReturnType<typeof initialSettings>; children?: ReactNode }) {
  const archive = useWeatherArchive();
  const { station, date, metric, threshold } = settings;
  const selectedStationChart = useMemo(() => chart.highlight({ name: station }), [chart, station]);
  const data = useMemo(() => archive.records && station === 'Melbourne'
    ? prepareWeather(archive.records, { station, date, metric, threshold: 0 }) : null,
  [archive.records, station, date, metric]);
  const baseCharts = useMemo(() => data ? makeWeatherCaseCharts(data) : null, [data]);
  const charts = useMemo(() => baseCharts ? { ...baseCharts,
    extreme: baseCharts.dots.where({ percentile: { gte: threshold } }),
    byYearX: baseCharts.byYearX.where({ percentile: { gte: threshold } }),
    byYear: baseCharts.byYear.where({ percentile: { gte: threshold } }),
    byTemperatureX: baseCharts.byTemperatureX.where({ percentile: { gte: threshold } }),
    byTemperature: baseCharts.byTemperature.where({ percentile: { gte: threshold } }),
  } : null, [baseCharts, threshold]);
  const extremeCount = data?.nearby.filter(row => row.percentile >= threshold).length ?? 0;
  const facts = {
    stationCount: chart.rows().length,
    year: data?.year ?? null, day: data?.day ?? null,
    recordCount: data?.selectedYear.length ?? null, windowCount: data?.nearby.length ?? null,
    extremeCount, temperature: data?.observation?.temperature ?? null,
    percentile: data?.observation?.percentile ?? null, metricLastDate: data?.metricLastDate ?? null,
    measureLabel: metric === 'tmax' ? 'Daily maximum' : 'Daily minimum',

  };
  const views = useMemo(() => ({ ...charts, stations: selectedStationChart,
    ...(charts ? { byYear: { chart: charts.byYear, via: [charts.byYearX] },
      byTemperature: { chart: charts.byTemperature, via: [charts.byTemperatureX] } } : {}),
  }), [charts, selectedStationChart]);
  const conditions = { ready: !!data && !!charts, missing: station !== 'Melbourne', observation: !!data?.observation,
    afterRecord: !!data && data.metricLastDate < date,
    selected: !!data?.observation && data.observation.percentile >= threshold,
    below: !!data?.observation && data.observation.percentile < threshold,
    empty: !!data && extremeCount === 0 };
  return <Context.Provider value={{ stationChart: selectedStationChart, data, charts, archive, facts, station, date, extremeCount }}><StoryData views={views} values={facts} conditions={conditions}>{children}</StoryData></Context.Provider>;
}

export function WeatherCaseStep({ view, children, ...props }: { view: keyof DailyCharts | 'stations'; id?: string; title?: string; children?: ReactNode }) {
  const { stationChart, charts } = useCase();
  const via = useMemo(() => !charts ? undefined : view === 'byYear' ? [charts.byYearX] : view === 'byTemperature' ? [charts.byTemperatureX] : undefined, [charts, view]);
  if (view === 'stations') return <Step {...props} chart={stationChart}>{children}</Step>;
  if (!charts) return null;
  if (!Object.hasOwn(charts, view)) throw new Error(`Unknown weather case view “${view}”.`);
  return <Step {...props} chart={charts[view]} via={via}>{children}</Step>;
}
export function WeatherValue({ name }: { name: string }) {
  const { facts } = useCase();
  if (!Object.hasOwn(facts, name)) throw new Error(`Unknown weather value “${name}”.`);
  return <span data-weather-value={name}>{facts[name] ?? '—'}</span>;
}
export function WeatherCaseContent({ when = 'ready', children }: { when?: 'ready' | 'missing' | 'observation' | 'afterRecord' | 'empty' | 'selected' | 'below'; children?: ReactNode }) {
  const { data, charts, station, date, extremeCount } = useCase();
  const [threshold] = useStoryVariable<number>('threshold');
  const visible = { ready: !!data && !!charts, missing: station !== 'Melbourne', observation: !!data?.observation,
    afterRecord: !!data && data.metricLastDate < date, selected: !!data?.observation && threshold !== undefined && data.observation.percentile >= threshold,
    below: !!data?.observation && threshold !== undefined && data.observation.percentile < threshold,
    empty: !!data && extremeCount === 0 };
  if (!Object.hasOwn(visible, when)) throw new Error(`Unknown weather content condition “${when}”.`);
  return visible[when] ? <>{children}</> : null;
}
export function WeatherCaseStatus() {
  const { archive } = useCase();
  if (archive.error) return <p role="alert">{archive.error} <button onClick={archive.retry}>Retry weather archive</button></p>;
  return !archive.records ? <p role="status">Loading archived daily observations…</p> : null;
}
export function WeatherArchiveLink({ children }: { children?: ReactNode }) {
  return <a href={weatherArchiveHref} target="_blank" rel="noopener noreferrer">{children}</a>;
}

/** Data-source name used by new MDX; keep WeatherCase for saved documents. */
export const WeatherArchive = WeatherCase;
export const WeatherArchiveStatus = WeatherCaseStatus;
