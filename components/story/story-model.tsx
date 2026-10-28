'use client';

import { useContext, useMemo, type ReactNode } from 'react';
import type { Visualization } from 'visdelta';
import { assertStoryValues, type StoryValues } from './variables';
import { useStoryVariables } from './bindings';

export interface StoryView { chart: Visualization; via?: Visualization[]; }
export interface StoryModel {
  /** Native VisDelta named dataset bindings, shared without inlining every view. */
  data?: Record<string, unknown>;
  views?: Readonly<Record<string, Visualization | StoryView>>;
  values?: StoryValues;
  conditions?: Readonly<Record<string, boolean>>;
}
import { StoryModelContext } from './story-model-context';
const noBindings: readonly string[] = [];

export function resolveView(model: StoryModel | null, name: string): StoryView {
  if (!model?.views || !Object.hasOwn(model.views, name)) throw new Error(`Unknown Story view “${name}”. Provide it in StoryData views.`);
  const view = model.views[name];
  return 'chart' in view ? view as StoryView : { chart: view as Visualization };
}
function validate(model: StoryModel) {
  if (!model || typeof model !== 'object' || Array.isArray(model) || 'then' in model) throw new Error('StoryData model must return a synchronous object with views, values or conditions.');
  if (model.values) assertStoryValues(model.values);
  if (model.conditions && Object.values(model.conditions).some(value => typeof value !== 'boolean')) throw new Error('StoryData conditions must be booleans.');
  for (const [name, view] of Object.entries(model.views ?? {})) {
    if (!view || typeof view !== 'object') throw new Error(`Story view “${name}” needs a native VisDelta chart.`);
    const resolved = resolveView(model, name);
    for (const chart of [resolved.chart, ...(resolved.via ?? [])]) {
      if (!chart || typeof chart !== 'object' || typeof (chart as { toSpec?: unknown }).toSpec !== 'function') throw new Error(`Story view “${name}” needs native VisDelta chart states.`);
    }
  }
}

/** React adapters supply data; ordinary stories can use a pure chart.js model. */
export function StoryData({ model, bind = noBindings, views, values, conditions, data, children }: StoryModel & {
  model?: (variables: StoryValues) => StoryModel;
  bind?: readonly string[];
  children?: ReactNode;
}) {
  const variables = useStoryVariables(bind);
  const result = useMemo(() => variables === null ? null : model ? model(variables) : { views, values, conditions, data }, [model, variables, views, values, conditions, data]);
  if (variables === null) return null;
  validate(result as StoryModel);
  return <StoryModelContext.Provider value={result}>{children}</StoryModelContext.Provider>;
}
export function Show({ when, children }: { when: string; children?: ReactNode }) {
  const model = useContext(StoryModelContext);
  if (!model?.conditions || !Object.hasOwn(model.conditions, when)) throw new Error(`Unknown Story condition “${when}”. Provide it in StoryData conditions.`);
  return model.conditions[when] ? <>{children}</> : null;
}
