import { line } from 'visdelta/line';
import { point } from 'visdelta/point';
import { unit } from 'visdelta/unit';
import { bar } from 'visdelta/bar';
import type { prepareWeather } from './weather-data';

export function makeWeatherNarrativeCharts(data: ReturnType<typeof prepareWeather>, template?: ReturnType<typeof line>) {
  const colors = { domain: ['Selected year', 'Other years'], range: ['#dc532d', '#b9bec4'] };
  const temperature = { label: 'Temperature (°C)', domain: [-5, 50] };
  const days = { label: 'Seasonal calendar day (365-day reference)', format: 'd' };
  const tips = ['date', 'temperature', 'percentile', 'source'];
  const year = (template ?? line().x('day_of_year', { label: 'Day of selected year', format: 'd' }).y('temperature', temperature).breakdown('year').color('series', colors))
    .data(data.selectedYear).datumKey('id').key('id').sort('day_of_year').tooltip(tips);
  const history = point(data.nearby).datumKey('id').key('id').x('calendar_day', days)
    .y('temperature', temperature).color('series', colors).pointSize(1.8).tooltip(tips);
  return { year, history, select(threshold: number) {
    const selected = history.where({ percentile: { gte: threshold } });
    const byYearX = selected.x('year', { label: 'Year', format: 'd' });
    const byYear = byYearX.y('year_stack', { label: 'Slot in the full seasonal window', domain: undefined });
    const byTemperatureX = byYear.x('temperature', { label: 'Temperature (°C)' });
    const byTemperature = byTemperatureX.y('temperature_stack', { label: 'Slot in the full seasonal window', domain: undefined });
    const units = unit(data.nearby).datumKey('id').key('id').where({ percentile: { gte: threshold } })
      .value('one', { unitValue: 1, maxUnits: Math.max(1, data.nearby.length) }).size(2)
      .color('series', colors).tooltip(tips).group('bin').layout('bar', { columns: 1 });
    const bins = selected.rows().map(row => Number(row.bin));
    const lower = bins.length ? Math.min(...bins) : 0;
    const upper = bins.length ? Math.max(...bins) : 0;
    const binDomain = bins.length ? Array.from({ length: Math.round((upper - lower) * 2) + 1 }, (_, index) => lower + index / 2) : undefined;
    const histogram = bar(data.nearby).datumKey('id').where({ percentile: { gte: threshold } })
      .x('bin', { label: 'Temperature bin (°C), width 0.5°C', domain: binDomain }).y('one', { label: 'Selected days' })
      .rollup({ op: 'sum', label: 'Selected days' }).sort('bin');
    return { year, history, extreme: selected,
      byYear: { chart: byYear, via: [byYearX] }, byTemperature: { chart: byTemperature, via: [byTemperatureX] },
      binned: units, histogram };
  } };
}
