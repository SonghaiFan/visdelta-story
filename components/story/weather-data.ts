export interface WeatherObservation {
  id: string;
  date: string;
  year: number;
  metric: string;
  temperature: number;
  percentile: number;
  source: string;
  day_of_year: number;
}
export interface WeatherSettings { station: string; date: string; metric: string; threshold: number; }
/** Common month/day calendar; leap-day records have no reference-day slot. */
export function seasonalDay(date: string) {
  const monthDay = date.slice(5);
  if (monthDay === '02-29') return null;
  return Math.round((Date.parse(`2001-${monthDay}T00:00:00Z`) - Date.UTC(2001, 0, 1)) / 86400000) + 1;
}
/** Legacy documents retain ordinal-day alignment by default. The unified story
 * opts into month/day alignment, excluding leap days and centring Feb 29 on Feb 28.
 * Supplied percentile ranks are preserved, never recalculated as a new baseline.
 */
export function prepareWeather(records: WeatherObservation[], settings: WeatherSettings, calendar = false) {
  if (settings.station !== 'Melbourne') throw new Error(`No archived observations for ${settings.station}.`);
  const year = Number(settings.date.slice(0, 4));
  const parsed = Date.parse(`${settings.date}T00:00:00Z`);
  const day = Math.round((parsed - Date.UTC(year, 0, 1)) / 86400000) + 1;
  const selected = records.filter(row => row.metric === settings.metric);
  const selectedYear = selected.filter(row => row.year === year);
  const metricLastDate = selected.at(-1)?.date ?? '';
  const center = calendar ? seasonalDay(settings.date) ?? seasonalDay(`${year}-02-28`)! : day;
  const cycle = calendar ? 365 : 366;
  const window = selected.filter(row => {
    const ordinal = calendar ? seasonalDay(row.date) : row.day_of_year;
    if (ordinal === null) return false;
    const distance = Math.abs(ordinal - center);
    return Math.min(distance, cycle - distance) <= 7;
  });
  const enrich = (row: WeatherObservation) => ({
    ...row, calendar_day: seasonalDay(row.date), one: 1, bin: Math.floor(row.temperature * 2) / 2,
    series: row.year === year ? 'Selected year' : !calendar && row.year === 1910 ? '1910 baseline' : 'Other years',
    inWindow: windowIds.has(row.id),
  });
  const windowIds = new Set(window.map(row => row.id));
  const timeline = selected.filter(row => row.year === year || row.year === 1910 || windowIds.has(row.id)).map(enrich);
  const yearStacks = new Map<number, number>();
  const temperatureStacks = new Map<number, number>();
  const nearby = window.map(row => {
    const year_stack = (yearStacks.get(row.year) ?? 0) + 1;
    const temperature_stack = (temperatureStacks.get(row.temperature) ?? 0) + 1;
    yearStacks.set(row.year, year_stack);
    temperatureStacks.set(row.temperature, temperature_stack);
    return { ...enrich(row), year_stack, temperature_stack };
  });
  const extremes = nearby.filter(row => row.percentile >= settings.threshold);
  return { year, day, observation: selected.find(row => row.date === settings.date), metricLastDate, selectedYear: selectedYear.map(enrich), timeline, nearby, extremes };
}
