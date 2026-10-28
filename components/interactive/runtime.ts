'use client';
/**
 * Browser helpers shared by the playground, gallery and homepage. They run the
 * reader's (or the corpus's) VisDelta code against the real library build.
 */

export type ChartName = 'bar' | 'line' | 'area' | 'point' | 'unit' | 'pie';
type Factory = (data?: unknown) => ChartState;

/** The subset of a builder state these helpers rely on. */
export interface ChartState {
  toSpec(): Record<string, unknown> & { mark?: string; data?: unknown; encoding?: Record<string, unknown> };
  rows(source?: unknown[]): Record<string, unknown>[];
  chartModule(): { key: string };
}

export type Rows = Record<string, unknown>[];
type D3 = typeof import('d3');

const factoryLoaders: Record<ChartName, () => Promise<Factory>> = {
  bar: () => import('visdelta/bar').then((m) => m.bar as unknown as Factory),
  line: () => import('visdelta/line').then((m) => m.line as unknown as Factory),
  area: () => import('visdelta/area').then((m) => m.area as unknown as Factory),
  point: () => import('visdelta/point').then((m) => m.point as unknown as Factory),
  unit: () => import('visdelta/unit').then((m) => m.unit as unknown as Factory),
  pie: () => import('visdelta/pie').then((m) => m.pie as unknown as Factory),
};

export function loadFactory(name: ChartName) {
  return factoryLoaders[name]();
}

export async function loadFactories(names: ChartName[]) {
  const entries = await Promise.all(names.map(async (name) => [name, await loadFactory(name)] as const));
  return Object.fromEntries(entries) as Record<ChartName, Factory>;
}

let d3Promise: Promise<D3> | null = null;
/** Full D3, available to evaluated code as `d3` (as on the original site). */
export function loadD3() {
  d3Promise ??= import('d3');
  return d3Promise;
}
