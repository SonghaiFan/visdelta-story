import { render, transition, type ChartView, type Visualization } from 'visdelta';

type Options = NonNullable<Parameters<typeof transition>[2]> & { target: HTMLElement };
export interface StoryPlayback {
  progress(value: number): void;
  playTo(value: number, duration: number, onFrame: (value: number, complete: boolean) => void): void;
  update(states: Visualization[], position: number): Promise<void>;
  pause(): void;
  resize(): void;
  destroy(): void;
}
const family = (state: Visualization) => {
  const source = state as { chartModule?: () => { key: string }; mark?: string; toSpec?: () => { mark: string } };
  return source.chartModule?.().key ?? source.mark ?? source.toSpec?.().mark;
};

/** Prepare only a requested leg. Data controls use native endpoint
 * rendering; they do not compile every future transition in the chapter. */
export async function createStoryPlayback(initial: Visualization[], options: Options): Promise<StoryPlayback> {
  let states = initial;
  let position = 0;
  let generation = 0;
  let request = 0;
  let destroyed = false;
  let animation: number | null = null;
  type Endpoint = { host: HTMLDivElement; view: ChartView; state: Visualization };
  type Leg = { host: HTMLDivElement; controller?: Awaited<ReturnType<typeof transition>>; from?: Endpoint; to?: Endpoint; local?: number; dirty?: boolean };
  const legs = new Map<number, Promise<Leg>>();
  const mountedLegs = new Set<Leg>();
  let endpoint: Endpoint | undefined;
  const dimensions = () => ({
    width: options.width === 'auto' ? options.target.clientWidth : options.width,
    height: options.height === 'auto' ? options.target.clientHeight : options.height,
  });
  const host = () => {
    const node = document.createElement('div');
    node.className = 'story-chart-stage';
    node.style.cssText = 'position:absolute;inset:0;visibility:hidden;pointer-events:none';
    options.target.append(node);
    return node;
  };
  const removeLeg = (leg: Leg) => {
    leg.controller?.destroy(); leg.from?.view.destroy(); leg.to?.view.destroy(); leg.host.remove(); mountedLegs.delete(leg);
  };
  const hide = () => {
    if (endpoint) { endpoint.host.style.visibility = 'hidden'; endpoint.host.remove(); }
    mountedLegs.forEach(leg => { leg.host.style.visibility = 'hidden'; leg.host.remove(); });
  };
  const pause = () => { request++; if (animation !== null) cancelAnimationFrame(animation); animation = null; };
  async function makeEndpoint(state: Visualization, parent = options.target): Promise<Endpoint> {
    const node = host(); parent.append(node);
    const view = await render(node, state, { ...options, ...(parent === options.target ? {} : dimensions()), updates: { policy: 'latest' } });
    return { host: node, view, state };
  }
  async function showEndpoint(index: number, ticket: number) {
    const state = states[index];
    if (!state || destroyed) return;
    let next = endpoint;
    if (!next || next.state !== state || !next.host.isConnected) {
      // A data control requests an immediate frame, not a route from the old
      // declaration. Render only the destination through VisDelta's renderer.
      next = await makeEndpoint(state);
      if (destroyed || ticket !== request) { next.view.destroy(); next.host.remove(); return; }
      endpoint?.view.destroy(); endpoint?.host.remove(); endpoint = next;
    }
    if (destroyed || ticket !== request) return;
    if (!next.host.isConnected || next.host.style.visibility === 'hidden') { hide(); options.target.append(next.host); }
    next.host.style.visibility = ''; next.host.style.pointerEvents = 'auto';
  }
  function prepareLeg(index: number): Promise<Leg> {
    const cached = legs.get(index);
    if (cached) return cached;
    const revision = generation;
    const from = states[index], to = states[index + 1];
    const pending = (async () => {
      const node = host();
      const leg: Leg = { host: node };
      try {
        if (family(from) === family(to)) leg.controller = await transition(from, to, { ...options, ...dimensions(), target: node });
        else {
          leg.from = await makeEndpoint(from, node);
          leg.to = await makeEndpoint(to, node);
          leg.from.host.style.visibility = ''; leg.to.host.style.visibility = '';
        }
        if (destroyed || revision !== generation) { removeLeg(leg); throw new Error('Stale Story transition.'); }
        mountedLegs.add(leg);
        leg.host.remove();
        return leg;
      } catch (error) { removeLeg(leg); throw error; }
    })();
    legs.set(index, pending);
    return pending;
  }
  function draw(leg: Leg, value: number, index: number) {
    if (!leg.host.isConnected) { hide(); options.target.append(leg.host); }
    leg.host.style.visibility = '';
    if (leg.dirty) { leg.controller?.resize(dimensions()); leg.from?.view.resize(dimensions()); leg.to?.view.resize(dimensions()); leg.dirty = false; } leg.host.style.pointerEvents = 'auto';
    const local = Math.max(0, Math.min(1, value - index));
    if (leg.local !== local) { leg.controller?.progress(local); leg.local = local; }
    if (leg.from && leg.to) {
      leg.from.host.style.opacity = String(1 - local); leg.to.host.style.opacity = String(local);
      leg.from.host.style.pointerEvents = local < 0.5 ? 'auto' : 'none';
      leg.to.host.style.pointerEvents = local >= 0.5 ? 'auto' : 'none';
      leg.from.host.setAttribute('aria-hidden', String(local === 1));
      leg.to.host.setAttribute('aria-hidden', String(local === 0));
    }
    position = value;
  }
  const report = (error: unknown) => {
    if (!destroyed && !(error instanceof Error && error.message === 'Stale Story transition.')) options.target.dispatchEvent(new CustomEvent('story-playback-error', { detail: error, bubbles: true }));
  };
  await showEndpoint(0, request);
  return {
    progress(value) {
      pause();
      const ticket = request;
      position = Math.max(0, Math.min(states.length - 1, value));
      if (Number.isInteger(position)) { void showEndpoint(position, ticket).catch(report); return; }
      const index = Math.floor(position);
      const intended = position;
      void prepareLeg(index).then(leg => { if (ticket === request && !destroyed) draw(leg, intended, index); }).catch(report);
    },
    playTo(value, duration, onFrame) {
      pause();
      const ticket = request;
      const from = position;
      if (duration <= 0 || from === value) {
        position = value; void showEndpoint(value, ticket).then(() => { if (ticket === request) onFrame(value, true); }).catch(report); return;
      }
      onFrame(from, false);
      void (async () => {
        const first = Math.max(0, Math.floor(Math.min(from, value)));
        const last = Math.min(states.length - 2, Math.ceil(Math.max(from, value)) - 1);
        for (let index = first; index <= last; index++) {
          await prepareLeg(index);
          if (destroyed || ticket !== request) return;
        }
        const start = performance.now();
        const tick = (now: number) => {
          if (destroyed || ticket !== request) return;
          const fraction = Math.min(1, Math.max(0, (now - start) / duration));
          const next = fraction === 1 ? value : from + (value - from) * fraction;
          const index = Math.max(first, Math.min(last, Math.floor(next)));
          void legs.get(index)!.then(leg => { if (ticket === request) draw(leg, next, index); });
          onFrame(next, fraction === 1);
          animation = fraction < 1 ? requestAnimationFrame(tick) : null;
        };
        animation = requestAnimationFrame(tick);
      })().catch(report);
    },
    async update(next, value) {
      pause(); generation++;
      const previous = [...mountedLegs];
      legs.clear();
      states = next;
      position = Math.max(0, Math.min(states.length - 1, Math.round(value)));
      await showEndpoint(position, request);
      // Keep the preceding frame visible until its replacement is committed.
      previous.forEach(removeLeg);
    },
    pause,
    resize() {
      if (endpoint?.host.isConnected) endpoint.view.resize({ width: options.width, height: options.height });
      mountedLegs.forEach(leg => {
        if (leg.host.isConnected) { leg.controller?.resize(dimensions()); leg.from?.view.resize(dimensions()); leg.to?.view.resize(dimensions()); }
        else leg.dirty = true;
      });
    },
    destroy() {
      pause(); generation++; destroyed = true;
      endpoint?.view.destroy(); endpoint?.host.remove(); mountedLegs.forEach(removeLeg); legs.clear();
    },
  };
}
