/** Document UI values belong to Story, independently of VisDelta chart states. */
export type StoryValue = string | number | boolean | null;
export type StoryValues = Readonly<Record<string, StoryValue>>;

export function assertStoryValue(value: unknown): asserts value is StoryValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return;
  throw new Error('Story variables must be text, finite numbers, booleans or null.');
}
export function assertVariableName(name: string) {
  if (typeof name !== 'string' || !name.trim()) throw new Error('Give each Story variable a non-empty name.');
}
export function assertStoryValues(values: StoryValues) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('Story initial values must be an object.');
  Object.entries(values).forEach(([name, value]) => { assertVariableName(name); assertStoryValue(value); });
}
export function createStoryStore(initial: StoryValues = {}) {
  const seedOwner = Symbol('initial');
  const declarations = new Map<string, Map<string | symbol, StoryValue>>();
  const defaults = new Map<string, StoryValue>();
  const values = new Map<string, StoryValue>();
  const bindings = new Map<string, string>();
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach(listener => listener());
  function sync(name: string) {
    const owners = declarations.get(name);
    if (owners?.size !== 1) return false;
    const value = owners.values().next().value as StoryValue;
    if (defaults.has(name) && Object.is(defaults.get(name), value)) return false;
    defaults.set(name, value); values.set(name, value);
    return true;
  }
  function seed(next: StoryValues) {
    assertStoryValues(next);
    declarations.forEach((owners, name) => {
      owners.delete(seedOwner);
      if (!owners.size) declarations.delete(name);
    });
    Object.entries(next).forEach(([name, value]) => {
      const owners = declarations.get(name) ?? new Map();
      owners.set(seedOwner, value); declarations.set(name, owners);
    });
    declarations.forEach((_, name) => { sync(name); });
    publish();
  }
  seed(initial);
  return {
    seed,
    get: (name: string) => declarations.has(name) ? values.get(name) : undefined,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    declare(name: string, value: StoryValue, owner: string) {
      assertVariableName(name); assertStoryValue(value);
      const owners = declarations.get(name) ?? new Map();
      owners.set(owner, value); declarations.set(name, owners);
      sync(name); publish();
      return () => {
        owners.delete(owner);
        if (!owners.size) declarations.delete(name);
        sync(name); publish();
      };
    },
    bind(name: string, owner: string) {
      assertVariableName(name); bindings.set(owner, name);
      return () => { bindings.delete(owner); };
    },
    set(name: string, value: StoryValue) {
      assertStoryValue(value);
      if (!declarations.has(name)) throw new Error(`Unknown Story variable “${name}”. Declare it with Var or Story initial.`);
      const previous = values.get(name);
      if (typeof previous !== typeof value || (previous === null) !== (value === null)) throw new Error(`Keep the value type of Story variable “${name}” consistent.`);
      if (!Object.is(previous, value)) { values.set(name, value); publish(); }
    },
    validate() {
      declarations.forEach((owners, name) => {
        if (owners.size > 1) throw new Error(`Duplicate Story variable “${name}”. Declare each name once per Story.`);
      });
      bindings.forEach(name => {
        if (!declarations.has(name)) throw new Error(`Unknown Story variable “${name}”. Declare it with Var or Story initial.`);
      });
    },
    prune() {
      let changed = false;
      values.forEach((_, name) => {
        if (!declarations.has(name)) { values.delete(name); defaults.delete(name); changed = true; }
      });
      if (changed) publish();
    },
  };
}
