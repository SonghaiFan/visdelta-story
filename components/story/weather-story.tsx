'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { line } from 'visdelta/line';
import { useStoryVariable } from './bindings';
import { makeDemoCharts } from './weather-demo-charts';
import { StoryData } from './story-model';
import { Scrolly, Step } from './story-components';
import { useWeatherArchive, weatherArchiveHref } from './weather-archive';
import { prepareWeather, type WeatherSettings } from './weather-data';
import stations from './weather-stations.json';

type Line = ReturnType<typeof line>;
const defaults: WeatherSettings = { station: 'Melbourne', date: '2022-02-14', metric: 'tmax', threshold: 95 };
const viewNames = ['year', 'comparison', 'history', 'extreme', 'distribution'] as const;
type View = typeof viewNames[number];
const WeatherContext = createContext<ReturnType<typeof makeDemoCharts> | null>(null);

export function WeatherStep({ view, id, children }: { view: View; id?: string; children?: ReactNode }) {
  const charts = useContext(WeatherContext);
  if (!charts) throw new Error('Place WeatherStep inside Weather.');
  if (!viewNames.includes(view)) throw new Error(`Choose a weather view: ${viewNames.join(', ')}.`);
  return <Step id={id ?? `weather-${view}`} chart={charts[view]}>{children}</Step>;
}

export function initialSettings(value?: Partial<WeatherSettings>): WeatherSettings {
  const result = { ...defaults, ...value };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.date) || result.date < '1910-01-01' || result.date > '2022-04-20' || !Number.isFinite(Date.parse(`${result.date}T00:00:00Z`))) throw new Error('Choose a weather date from 1910-01-01 to 2022-04-20.');
  if (!['tmax', 'tmin'].includes(result.metric)) throw new Error('Weather metric must be tmax or tmin.');
  if (typeof result.threshold !== 'number' || !Number.isFinite(result.threshold) || result.threshold < 0 || result.threshold > 100) throw new Error('Weather threshold must be a number from 0 to 100.');
  if (!stations.some(station => station.name === result.station)) throw new Error('Choose a station from the archived catalogue.');
  return result;
}

type WeatherBindings = Partial<Record<keyof WeatherSettings, string>>;
const weatherBindings: WeatherBindings = { date: 'date', threshold: 'threshold', station: 'station', metric: 'metric' };
export const stationOptions = stations.map(item => ({ value: item.name, label: item.name === 'Melbourne' ? item.name : `${item.name} · no archived records` }));
export const measureOptions = [{ value: 'tmax', label: 'Daily maximum' }, { value: 'tmin', label: 'Daily minimum' }];

export function Weather({ chart, settings, bind, children }: { chart?: Line; settings?: Partial<WeatherSettings>; bind?: true | WeatherBindings; children?: ReactNode }) {
  if (bind) return <BoundWeather chart={chart} settings={settings} bindings={bind === true ? weatherBindings : bind}>{children}</BoundWeather>;
  const initial = initialSettings(settings);
  // Editing configuration resets defaults; ordinary prose edits preserve the
  // reader's controls. No hooks or event handlers need to appear in the MDX.
  return <WeatherSession key={JSON.stringify(initial)} initial={initial} chart={chart}>{children}</WeatherSession>;
}
function WeatherSession({ initial, chart, children }: { initial: WeatherSettings; chart?: Line; children?: ReactNode }) {
  const [settings, setSettings] = useState(initial);
  return <WeatherView settings={settings} chart={chart} controls={<LegacyControls settings={settings} update={(field, value) => setSettings(current => ({ ...current, [field]: value }))} />}>{children}</WeatherView>;
}
function BoundWeather({ chart, settings, bindings, children }: { chart?: Line; settings?: Partial<WeatherSettings>; bindings: WeatherBindings; children?: ReactNode }) {
  const [date] = useStoryVariable(bindings.date);
  const [threshold] = useStoryVariable(bindings.threshold);
  const [station] = useStoryVariable(bindings.station);
  const [metric] = useStoryVariable(bindings.metric);
  const linked = { date, threshold, station, metric };
  if ((Object.keys(bindings) as (keyof WeatherSettings)[]).some(field => linked[field] === undefined)) return null;
  const merged = { ...settings, ...Object.fromEntries(Object.entries(linked).filter(([, value]) => value !== undefined)) };
  const selected = initialSettings(merged as Partial<WeatherSettings>);
  return <WeatherView settings={selected} chart={chart}>{children}</WeatherView>;
}
function WeatherView({ settings, chart, controls, children }: { settings: WeatherSettings; chart?: Line; controls?: ReactNode; children?: ReactNode }) {
  const archive = useWeatherArchive();
  const { station, date, metric, threshold } = settings;
  const data = useMemo(() => archive.records && station === 'Melbourne'
    ? prepareWeather(archive.records, { station, date, metric, threshold: 0 }) : null,
  [archive.records, station, date, metric]);
  const charts = useMemo(() => data ? makeDemoCharts(data, threshold, chart) : null, [data, threshold, chart]);
  const count = data?.nearby.filter(row => row.percentile >= threshold).length ?? 0;
  if (chart && chart.chartModule().key !== 'line') throw new Error('The Weather chart template should be a VisDelta line chart.');
  return <>
    {controls}
    {archive.error && <p role="alert">{archive.error} <button onClick={archive.retry}>Retry weather archive</button></p>}
    {!archive.records && !archive.error && <p role="status">Loading archived observations…</p>}
    {station !== 'Melbourne' && <section><h2>No archived observations for {station}</h2><p>Choose Melbourne to explore the available weather record.</p></section>}
    {data && charts && <>
      <p className="weather-selection" data-testid="weather-demo-summary">{station} · {metric === 'tmax' ? 'Daily maximum' : 'Daily minimum'} · {count} of {data.nearby.length} window observations at percentile ≥ {threshold}</p>
      {data.observation && <p data-testid="weather-day">{date}: <strong>{data.observation.temperature}°C</strong>, archived percentile {data.observation.percentile}.</p>}
      {!data.observation && <p>No observation for {date} in the selected measure.</p>}
      <WeatherContext.Provider value={charts}><StoryData views={charts}><Scrolly id="weather-demo" chartStyle="paper" lazy>{children}</Scrolly></StoryData></WeatherContext.Provider>
    </>}
    <details><summary>About the data</summary><p>This earlier case-study archive contains 82,033 Melbourne records, from 1910 to April 2022. Other station observations are unavailable. Percentile ranks come from the original file; their reference population is undocumented. A high percentile for daily minimum selects warm nights. The nearby-day window follows the old ordinal-day alignment, including its leap-year offset. The 2022 record is partial.</p><a href={weatherArchiveHref} target="_blank" rel="noopener noreferrer">Inspect the archive</a></details>
  </>;
}

function LegacyControls({ settings, update }: { settings: WeatherSettings; update(field: keyof WeatherSettings, value: string | number): void }) {
  const { date, threshold, station, metric } = settings;
  return <div className="weather-controls">
    <div className="weather-control-fields">
      <label>Date<input aria-label="Weather date" type="date" min="1910-01-01" max="2022-04-20" value={date} onChange={event => { if (event.target.value) update('date', event.target.value); }} /></label>
      <label>Percentile: <output>{threshold}</output><input aria-label="Extreme weather percentile" type="range" min="0" max="100" step="1" value={threshold} onChange={event => update('threshold', Number(event.target.value))} /></label>
    </div>
    <details><summary>More options</summary><div className="weather-control-fields">
      <label>Station<select aria-label="Weather station" value={station} onChange={event => update('station', event.target.value)}>{stationOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label>Temperature<select aria-label="Weather measure" value={metric} onChange={event => update('metric', event.target.value)}>{measureOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
    </div></details>
  </div>;
}
