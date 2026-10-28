'use client';

import { useEffect, useState } from 'react';
import { basePath } from '@/lib/shared';

import type { WeatherObservation } from './weather-data';
export { prepareWeather } from './weather-data';
interface ArchiveFile {
  city: string;
  columns: string[];
  rows: [string, string, number, number, string, number][];
}
export const weatherArchiveHref = `${basePath}/data/weather/melbourne.json`;
let archive: Promise<WeatherObservation[]> | undefined;
export function loadWeatherArchive(): Promise<WeatherObservation[]> {
  archive ??= fetch(weatherArchiveHref).then(async response => {
    if (!response.ok) throw new Error(`Weather archive could not load (${response.status}).`);
    const file: ArchiveFile = await response.json();
    if (file.city !== 'Melbourne' || file.rows.length !== 82033) throw new Error('Weather archive is incomplete.');
    return file.rows.map(([date, metric, temperature, percentile, source, day_of_year]) => ({
      id: `${date}:${metric}`, date, year: Number(date.slice(0, 4)), metric,
      temperature, percentile, source, day_of_year,
    }));
  }).catch(error => { archive = undefined; throw error; });
  return archive;
}
export function useWeatherArchive() {
  const [result, setResult] = useState<{ records?: WeatherObservation[]; error?: string }>({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void loadWeatherArchive().then(records => {
      if (!cancelled) setResult({ records });
    }).catch(error => {
      if (!cancelled) setResult({ error: error instanceof Error ? error.message : String(error) });
    });
    return () => { cancelled = true; };
  }, [attempt]);
  return { ...result, retry: () => { setResult({}); setAttempt(value => value + 1); } };
}
