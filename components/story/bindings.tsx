'use client';

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useState, useSyncExternalStore, type ReactNode, type CSSProperties } from 'react';
import { assertStoryValue, assertStoryValues, assertVariableName, createStoryStore, type StoryValue, type StoryValues } from './variables';

import { StoryModelContext } from './story-model-context';

const Scope = createContext<ReturnType<typeof createStoryStore> | null>(null);
const empty: StoryValues = {};
const noSubscribe = () => () => {};
const noValue = () => undefined;

export function Story({ initial = empty, children, className, style }: { initial?: StoryValues; children?: ReactNode; className?: string; style?: CSSProperties }) {
  assertStoryValues(initial);
  const [store] = useState(() => createStoryStore(initial));
  const initialKey = JSON.stringify(initial);
  // Compare the authored values, not the newly evaluated MDX object's identity.
  useLayoutEffect(() => { store.seed(JSON.parse(initialKey)); }, [store, initialKey]);
  useEffect(() => { store.validate(); store.prune(); }, [store, children, initialKey]);
  return <Scope.Provider value={store}><div data-story-scope="" className={className} style={style}>{children}</div></Scope.Provider>;
}
export function Var({ name, value }: { name: string; value: StoryValue }) {
  const store = useContext(Scope);
  const owner = useId();
  assertVariableName(name); assertStoryValue(value);
  if (!store) throw new Error('Place Var inside Story.');
  useLayoutEffect(() => store.declare(name, value, owner), [store, name, value, owner]);
  useEffect(() => { store.validate(); }, [store, name, value]);
  return null;
}

/** Custom React components can participate without a parser or expression DSL. */
export function useStoryVariable<T extends StoryValue = StoryValue>(name?: string): [T | undefined, (value: T) => void] {
  const store = useContext(Scope);
  const owner = useId();
  if (name !== undefined) {
    assertVariableName(name);
    if (!store) throw new Error(`Place the binding for “${name}” inside Story.`);
  }
  const snapshot = useCallback(() => name !== undefined ? store?.get(name) as T | undefined : undefined, [store, name]);
  const value = useSyncExternalStore(store?.subscribe ?? noSubscribe, snapshot, noValue);
  useLayoutEffect(() => name !== undefined ? store?.bind(name, owner) : undefined, [store, name, owner]);
  useEffect(() => { if (name !== undefined) store?.validate(); }, [store, name, value]);
  const set = useCallback((next: T) => {
    if (!store || name === undefined) throw new Error('A Story binding needs a declared variable.');
    store.set(name, next);
  }, [store, name]);
  return [value, set];
}
/** A single subscription supports a model's explicit list of input variables. */
export function useStoryVariables(names: readonly string[]): StoryValues | null {
  const store = useContext(Scope);
  const owner = useId();
  const key = JSON.stringify(names);
  if (!Array.isArray(names) || new Set(names).size !== names.length) throw new Error('StoryData bind must list distinct variable names.');
  names.forEach(assertVariableName);
  if (names.length && !store) throw new Error('Place bound StoryData inside Story.');
  const snapshot = useCallback(() => JSON.stringify(JSON.parse(key).map((name: string) => { const value = store?.get(name); return value === undefined ? [false] : [true, value]; })), [store, key]);
  const encoded = useSyncExternalStore(store?.subscribe ?? noSubscribe, snapshot, snapshot);
  useLayoutEffect(() => {
    const cleanups = (JSON.parse(key) as string[]).map((name, index) => store!.bind(name, `${owner}:${index}`));
    return () => cleanups.forEach(cleanup => cleanup());
  }, [store, key, owner]);
  useEffect(() => { if (JSON.parse(key).length) store?.validate(); }, [store, key, encoded]);
  return useMemo(() => {
    const keys = JSON.parse(key) as string[];
    // Null is a valid value; inspect declarations to distinguish an absent name.
    if (keys.some(name => store?.get(name) === undefined)) return null;
    const values = JSON.parse(encoded) as [boolean, StoryValue][];
    return Object.fromEntries(keys.map((name, index) => [name, values[index][1]]));
  }, [store, key, encoded]);
}
export function Value({ name, className, style }: { name: string; className?: string; style?: CSSProperties }) {
  const model = useContext(StoryModelContext);
  const derived = !!model?.values && Object.hasOwn(model.values, name);
  const [variable] = useStoryVariable(derived ? undefined : name);
  const value = derived ? model!.values![name] : variable;
  return <span data-story-value={name} className={className} style={style}>{value === undefined ? null : value === null ? '—' : String(value)}</span>;
}
export function Controls({ children, label = 'Story controls', className, style }: { children?: ReactNode; label?: string; className?: string; style?: CSSProperties }) {
  return <fieldset className={`story-controls ${className ?? ''}`} style={style} aria-label={label}>{children}</fieldset>;
}
export function Range({ bind, label = bind, min = 0, max = 100, step = 1 }: { bind: string; label?: string; min?: number; max?: number; step?: number }) {
  const [value, set] = useStoryVariable(bind);
  if (![min, max, step].every(Number.isFinite) || min >= max || step <= 0) throw new Error(`Range “${bind}” needs finite min < max and a positive step.`);
  if (value === undefined) return null;
  if (typeof value !== 'number' || value < min || value > max) throw new Error(`Range “${bind}” needs a numeric variable between ${min} and ${max}.`);
  return <label className="story-control"><span>{label}: <output>{value}</output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={event => set(Number(event.target.value))} /></label>;
}
function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function DatePicker({ bind, label = bind, min, max, required = false }: { bind: string; label?: string; min?: string; max?: string; required?: boolean }) {
  const [value, set] = useStoryVariable(bind);
  if ((min && !validDate(min)) || (max && !validDate(max)) || (min && max && min > max)) throw new Error(`DatePicker “${bind}” needs valid date bounds.`);
  if (value === undefined) return null;
  if (typeof value !== 'string' || (value ? !validDate(value) || (min && value < min) || (max && value > max) : required)) throw new Error(`DatePicker “${bind}” needs a valid YYYY-MM-DD date within its bounds.`);
  return <label className="story-control">{label}<input aria-label={label} type="date" value={value} min={min} max={max} required={required} onChange={event => { if (event.currentTarget.validity.valid) set(event.target.value); }} /></label>;
}
export interface SelectOption { value: string | number; label: string; }
export function Select({ bind, label = bind, options }: { bind: string; label?: string; options: readonly (SelectOption | string)[] }) {
  const [value, set] = useStoryVariable(bind);
  if (!Array.isArray(options) || !options.length) throw new Error(`Select “${bind}” needs options.`);
  const choices = options.map(option => typeof option === 'string' ? { value: option, label: option } : option);
  if (choices.some(option => !option || !['string', 'number'].includes(typeof option.value) || typeof option.label !== 'string' || (typeof option.value === 'number' && !Number.isFinite(option.value))) || new Set(choices.map(option => String(option.value))).size !== choices.length) throw new Error(`Select “${bind}” needs distinct text or numeric option values and labels.`);
  if (value === undefined) return null;
  if (!choices.some(option => Object.is(option.value, value))) throw new Error(`Select “${bind}” has no option for its variable's value.`);
  return <label className="story-control">{label}<select aria-label={label} value={String(value)} onChange={event => { const choice = choices.find(option => String(option.value) === event.target.value); if (choice) set(choice.value); }}>{choices.map(option => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}</select></label>;
}
