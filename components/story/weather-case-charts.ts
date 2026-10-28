import { line } from 'visdelta/line';
import { point } from 'visdelta/point';
import { unit } from 'visdelta/unit';
import { bar } from 'visdelta/bar';
import { prepareWeather } from './weather-data';

export function makeWeatherCaseCharts(data: ReturnType<typeof prepareWeather>, threshold?: number) {
  const colors = { domain: ['Selected year', '1910 baseline', 'Other years'], range: ['#dc532d', '#286bb1', '#b9bec4'] }
  const temperature = { label: 'Temperature (°C)', domain: [-10, 50] }
  const days = { label: 'Day of year', format: 'd' }
  const tips = ['date', 'temperature', 'percentile', 'source']
  const timeline = line(data.timeline).datumKey('id').key('id')
    .x('day_of_year', days).y('temperature', temperature)
    .breakdown('year').color('series', colors).sort('day_of_year').tooltip(tips)
  const year = timeline.where({ year: data.year })
  const comparison = timeline.where({ year: [1910, data.year] })
  const window = timeline.where({ inWindow: true })
  const dots = point(data.nearby).datumKey('id').key('id')
    .x('day_of_year', days).y('temperature', temperature)
    .color('series', colors).pointSize(1.8).tooltip(tips)
  const extreme = threshold == null ? dots : dots.where({ percentile: { gte: threshold } })
  const units = unit(data.nearby).datumKey('id').key('id').value('one', { unitValue: 1, maxUnits: Math.max(1, data.nearby.length) }).size(2)
    .color('series', colors).tooltip(tips)
  const byYearX = extreme.x('year', { label: 'Year', format: 'd' })
  const byYear = byYearX.y('year_stack', { label: 'Position in full-window stack', domain: undefined })
  const byTemperatureX = byYear.x('temperature', { label: 'Temperature (°C)' })
  const byTemperature = byTemperatureX.y('temperature_stack', { label: 'Position in full-window stack', domain: undefined })
  const allTemperatures = dots.x('temperature', { label: 'Temperature (°C)' }).y('temperature_stack', { label: 'Position in full-window stack', domain: undefined }).pointSize(1.8)
  const binned = units.group('bin').layout('bar', { columns: 1 })
  const histogram = bar(data.nearby).datumKey('id').x('bin', { label: 'Temperature bin (°C), width 0.5°C' })
    .y('one', { label: 'Days' }).rollup({ op: 'sum' }).sort('bin')
  const annualHistogram = histogram.data(data.selectedYear)
  return { year, comparison, zoom: comparison.where({ inWindow: true }), window,
    dots, extreme, byYearX, byYear, byTemperatureX, byTemperature, allTemperatures, binned, histogram, annualHistogram }
}
