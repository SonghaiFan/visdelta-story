import { line } from 'visdelta/line';
import { point } from 'visdelta/point';
import { bar } from 'visdelta/bar';
import type { prepareWeather } from './weather-data';

type Analysis = ReturnType<typeof prepareWeather>;
type Line = ReturnType<typeof line>;
const colors = { domain: ['Selected year', '1910 baseline', 'Other years'], range: ['#dc532d', '#286bb1', '#b9bec4'] };

export function makeDemoCharts(data: Analysis, threshold: number, template?: Line) {
  const timeline = (template ?? line().x('day_of_year', { label: 'Day of year', format: 'd' })
    .y('temperature', { label: 'Temperature (°C)', domain: [-10, 50] }).breakdown('year').color('series', colors))
    .data(data.timeline).datumKey('id').key('id').sort('day_of_year').tooltip(['date', 'temperature']);
  const history = point(data.nearby).datumKey('id').key('id')
    .x('day_of_year', { label: 'Day of year', format: 'd' })
    .y('temperature', { label: 'Temperature (°C)', domain: [-10, 50] })
    .color('series', colors).pointSize(2).tooltip(['date', 'temperature', 'percentile']);
  const selection = { percentile: { gte: threshold } };
  return {
    year: timeline.where({ year: data.year }),
    comparison: timeline.where({ year: [1910, data.year] }),
    history,
    extreme: history.where(selection),
    distribution: bar(data.nearby).datumKey('id').where(selection)
      .x('bin', { label: 'Temperature bin (°C), width 0.5°C' })
      .y('one', { label: 'Days' }).rollup({ op: 'sum' }).sort('bin'),
  };
}
