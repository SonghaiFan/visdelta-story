'use client';

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import type { Visualization } from 'visdelta';
import { chartStylePresets } from 'visdelta/chart-style';
import { Story, Var, Range, DatePicker, Select, Value, Controls } from './bindings';
import { StoryData, Show, resolveView } from './story-model';
import { StoryModelContext } from './story-model-context';
import { positionAt, stepAt } from './scroll';

interface ReaderContext {
  viewport: RefObject<HTMLDivElement | null>;
  reportError(message: string): void;
}
export const StoryReaderContext = createContext<ReaderContext | null>(null);

interface StepRecord { element: HTMLElement; chart: Visualization; via?: Visualization[]; title: string; }
interface StepsContext {
  register(key: string, step: StepRecord): () => void;
}
const Steps = createContext<StepsContext | null>(null);

export interface StepProps {
  id?: string;
  title?: string;
  chart?: Visualization;
  view?: string;
  via?: Visualization[];
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}
export function Step({ id, title, chart: explicitChart, view, via: explicitVia, children, className, style }: StepProps) {
  const model = useContext(StoryModelContext);
  const resolved = useMemo(() => view === undefined ? undefined : resolveView(model, view), [model, view]);
  const chart = explicitChart ?? resolved?.chart;
  const via = explicitVia ?? resolved?.via;
  if (view !== undefined && explicitChart) throw new Error('Give Step either a view name or an explicit chart.');
  const context = useContext(Steps);
  const key = useId();
  const element = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (!context || !element.current || !chart) return;
    return context.register(key, { element: element.current, chart, via, title: title ?? '' });
  }, [context, key, chart, via, title]);
  if (!context) throw new Error('Place each Step inside a Scrolly component.');
  if (!chart || typeof chart !== 'object' || !('toSpec' in chart || 'mark' in chart)) throw new Error('Each Step needs a VisDelta chart state.');
  return <article id={id ?? `step-${key.replace(/[^a-zA-Z0-9_-]/g, '')}`} ref={element} className={`story-step ${className ?? ''}`} style={style}>{children}</article>;
}

export interface ScrollyProps {
  id?: string;
  title?: string;
  layout?: 'left' | 'right' | 'overlay';
  hold?: number;
  playback?: 'step' | 'scrub';
  offset?: number;
  navigation?: boolean;
  lazy?: boolean;
  progress?: boolean;
  chartStyle?: keyof typeof chartStylePresets;
  theme?: 'inherit' | 'paper' | 'dark';
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}
type Controller = import('./playback').StoryPlayback;

function createChartMount() {
  const mount = document.createElement('div');
  mount.className = 'story-chart-mount';
  mount.style.visibility = 'hidden';
  return mount;
}

export function Scrolly({ id, title = 'Scrolling story', layout = 'left', hold = 0.45, playback = 'step', offset = 0.55, navigation = true, lazy = false, progress = true, chartStyle = 'd3', theme = 'inherit', children, className, style }: ScrollyProps) {
  const reader = useContext(StoryReaderContext);
  const section = useRef<HTMLElement>(null);
  const host = useRef<HTMLDivElement>(null);
  const progressElement = useRef<HTMLProgressElement>(null);
  const navigationElement = useRef<HTMLElement>(null);
  const readout = useRef<HTMLOutputElement>(null);
  const current = useRef<{ controller: Controller; mount: HTMLElement; config: string } | null>(null);
  const navigate = useRef<(index: number) => void>(() => {});
  const [records, setRecords] = useState<Map<string, StepRecord>>(new Map());
  const [nearby, setNearby] = useState(!lazy);
  const [status, setStatus] = useState('Preparing chart…');
  const register = useCallback((key: string, step: StepRecord) => {
    setRecords(previous => new Map(previous).set(key, step));
    return () => setRecords(previous => { const next = new Map(previous); next.delete(key); return next; });
  }, []);
  const registry = useMemo(() => ({ register }), [register]);
  const ordered = useMemo(() => [...records.values()].sort((a, b) => {
    const relation = a.element.compareDocumentPosition(b.element);
    return relation & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : relation & Node.DOCUMENT_POSITION_PRECEDING ? 1 : 0;
  }), [records]);
  const label = (step: StepRecord, index: number) => step.title || step.element.querySelector('h1,h2,h3,h4')?.textContent || `Step ${index + 1}`;

  useEffect(() => {
    const root = reader?.viewport.current;
    if (!root || !ordered.length) return;
    // Navigation must also work before a lazy chapter has prepared its chart.
    navigate.current = index => {
      const element = ordered[index]?.element;
      if (!element) return;
      root.scrollTo({ top: Math.max(0, Math.ceil(element.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - root.clientHeight * offset)), behavior: 'instant' });
      history.replaceState(null, '', `${location.pathname}${location.search}#${encodeURIComponent(element.id)}`);
    };
  }, [ordered, reader, offset]);

  useEffect(() => {
    if (!lazy) return;
    const container = section.current;
    const root = reader?.viewport.current;
    if (!container || !root) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const bounds = container.getBoundingClientRect();
      const viewport = root.getBoundingClientRect();
      setNearby(bounds.bottom >= viewport.top - 200 && bounds.top <= viewport.bottom + 200);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const observer = new ResizeObserver(schedule);
    observer.observe(container); observer.observe(root);
    root.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    const hash = () => {
      let id = '';
      try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
      const anchor = document.getElementById(id);
      if (anchor && container.contains(anchor)) {
        root.scrollTo({ top: Math.max(0, anchor.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - root.clientHeight * offset), behavior: 'instant' });
        setNearby(true);
      }
    };
    const hashFrame = requestAnimationFrame(hash);
    window.addEventListener('hashchange', hash);
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame); cancelAnimationFrame(hashFrame);
      root.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule);
      window.removeEventListener('hashchange', hash);
    };
  }, [lazy, reader, offset]);

  useEffect(() => {
    if (ordered.length) return;
    const frame = requestAnimationFrame(() => setStatus('Add a Step with a chart state to begin.'));
    return () => cancelAnimationFrame(frame);
  }, [ordered.length]);
  useEffect(() => () => { current.current?.controller.destroy(); current.current?.mount.remove(); current.current = null; }, []);
  useEffect(() => {
    const target = host.current;
    const root = reader?.viewport.current;
    const container = section.current;
    if (!target || !root || !container || !ordered.length) return;
    if (lazy && !nearby) { container.dataset.ready = 'false'; return; }
    const states: Visualization[] = [];
    const positions = ordered.map((step, index) => {
      if (index > 0 && step.via) states.push(...step.via);
      states.push(step.chart);
      return states.length - 1;
    });
    const authoredPosition = (value: number) => {
      const index = Math.floor(value);
      const next = Math.min(index + 1, positions.length - 1);
      return positions[index] + (positions[next] - positions[index]) * (value - index);
    };
    const storyPosition = (value: number) => {
      const end = positions.findIndex(position => position > value);
      if (end < 0) return positions.length - 1;
      if (end === 0) return 0;
      return end - 1 + (value - positions[end - 1]) / (positions[end] - positions[end - 1]);
    };
    const restoreOnMount = current.current === null;
    container.dataset.ready = 'false';
    let disposed = false;
    let frame = 0;
    let needsResize = false;
    let ready = false;
    let selectedIndex: number | null = null;
    let previousWidth = target.clientWidth;
    let previousHeight = target.clientHeight;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const config = JSON.stringify([chartStyle, theme, layout, playback]);
    const reuse = current.current?.config === config ? current.current : null;
    const mount = reuse?.mount ?? createChartMount();
    if (!reuse) target.append(mount);
    const anchors = () => ordered.map(({ element }) => element.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop - root.clientHeight * offset);
    const update = () => {
      frame = 0;
      if (disposed || !ready || !current.current) return;
      if (needsResize) { current.current.controller.resize(); needsResize = false; }
      const stepAnchors = anchors();
      const value = playback === 'scrub' ? positionAt(root.scrollTop, stepAnchors, hold) : stepAt(root.scrollTop, stepAnchors);
      const index = Math.min(ordered.length - 1, Math.floor(value + 0.00001));
      const reflect = (position: number, complete: boolean) => {
        if (disposed) return;
        container.dataset.position = String(storyPosition(position));
        container.dataset.playing = String(!complete);
        if (progressElement.current) progressElement.current.value = ordered.length === 1 ? 1 : storyPosition(position) / (ordered.length - 1);
      };
      if (playback === 'scrub' || selectedIndex === null || media.matches) {
        const position = authoredPosition(media.matches ? Math.round(value) : value);
        current.current.controller.progress(position); reflect(position, true);
      } else if (index !== selectedIndex) {
        // Retarget from the currently rendered frame when the reader reverses
        // or skips steps. Scrolling within a step never restarts its animation.
        current.current.controller.playTo(authoredPosition(index), 650, reflect);
      }
      selectedIndex = index;
      container.dataset.activeStep = String(index);
      if (readout.current) readout.current.textContent = `${index + 1} / ${ordered.length}`;
      navigationElement.current?.querySelectorAll('button').forEach((button, i) => {
        if (i === index) button.setAttribute('aria-current', 'step'); else button.removeAttribute('aria-current');
      });
      ordered.forEach(({ element }, i) => {
        if (i === index) element.setAttribute('aria-current', 'step'); else element.removeAttribute('aria-current');
      });
    };
    const schedule = () => { if (!disposed && !frame) frame = requestAnimationFrame(update); };
    const jump = (index: number) => {
      root.scrollTo({ top: Math.max(0, Math.ceil(anchors()[index])), behavior: 'instant' });
      schedule();
    };
    navigate.current = index => {
      jump(index);
      history.replaceState(null, '', `${location.pathname}${location.search}#${encodeURIComponent(ordered[index].element.id)}`);
    };
    const restoreHash = () => {
      let id: string;
      try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
      const index = ordered.findIndex(step => step.element.id === id);
      if (index >= 0) jump(index);
    };
    const playbackError = (event: Event) => {
      const error = (event as CustomEvent).detail;
      reader.reportError(error instanceof Error ? error.message : String(error));
    };
    mount.addEventListener('story-playback-error', playbackError);
    const geometry = new ResizeObserver(schedule);
    geometry.observe(root);
    geometry.observe(container);
    ordered.forEach(step => geometry.observe(step.element));
    const size = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width === previousWidth && height === previousHeight) return;
      previousWidth = width; previousHeight = height;
      needsResize = true; schedule();
    });
    size.observe(target);
    const themeObserver = new MutationObserver(() => { needsResize = true; schedule(); });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    root.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('hashchange', restoreHash);
    media.addEventListener('change', schedule);
    void document.fonts.ready.then(schedule);
    void (async () => {
      try {
        const ids = ordered.map(step => step.element.id);
        if (new Set(ids).size !== ids.length) throw new Error('Step IDs must be unique within a Scrolly.');
        const { createStoryPlayback } = await import('./playback');
        if (disposed) return;
        const options = { target: mount, width: 'auto' as const, height: 'auto' as const, chartStyle: chartStylePresets[chartStyle] };
        const initialIndex = stepAt(root.scrollTop, anchors());
        const controller = reuse?.controller ?? await createStoryPlayback(states, options);
        if (reuse) await controller.update(states, authoredPosition(initialIndex));
        if (disposed) { if (!reuse) { controller.destroy(); mount.remove(); } return; }
        if (!reuse) { current.current?.controller.destroy(); current.current?.mount.remove(); }
        current.current = { controller, mount, config };
        if (!reuse) mount.style.removeProperty('visibility');
        ready = true;
        container.dataset.ready = 'true';
        setStatus('');
        if (restoreOnMount) restoreHash();
        update();
      } catch (error) {
        if (!reuse) mount.remove();
        if (!disposed) {
          const message = error instanceof Error ? error.message : String(error);
          setStatus(message);
          reader.reportError(message);
        }
      }
    })();
    return () => {
      disposed = true;
      if (current.current?.mount === mount) current.current.controller.pause();
      cancelAnimationFrame(frame);
      mount.removeEventListener('story-playback-error', playbackError);
      geometry.disconnect(); size.disconnect(); themeObserver.disconnect();
      root.removeEventListener('scroll', schedule);
      window.removeEventListener('hashchange', restoreHash);
      media.removeEventListener('change', schedule);
      if (current.current?.mount !== mount) mount.remove();
    };
  }, [ordered, reader, hold, offset, chartStyle, theme, layout, lazy, nearby, playback]);

  if (!['step', 'scrub'].includes(playback)) throw new Error('Scrolly playback must be step or scrub.');
  if (!['left', 'right', 'overlay'].includes(layout)) throw new Error('Scrolly layout must be left, right or overlay.');
  if (!Number.isFinite(hold) || hold < 0 || hold >= 1) throw new Error('Scrolly hold must be between 0 (inclusive) and 1 (exclusive).');
  if (!Number.isFinite(offset) || offset < 0 || offset > 1) throw new Error('Scrolly offset must be between 0 and 1.');
  if (!['inherit', 'paper', 'dark'].includes(theme)) throw new Error('Scrolly theme must be inherit, paper or dark.');
  if (!Object.hasOwn(chartStylePresets, chartStyle)) throw new Error('Unknown chartStyle. Use d3, paper, dark or editorial.');
  return <section ref={section} id={id} className={`story-scrolly ${className ?? ''}`} style={style} data-layout={layout} data-playback={playback} data-story-theme={theme} aria-label={title}>
    <div className="story-visual">
      <div ref={host} className="story-chart" aria-label={`${title} chart`} />
      {progress && <div className="story-progress"><progress ref={progressElement} max={1} value={0} aria-label={`${title} progress`} /><output ref={readout}>1 / {Math.max(1, ordered.length)}</output></div>}
      {navigation && <nav ref={navigationElement} aria-label={`${title} steps`} className="story-step-nav">{ordered.map((step, index) => <button key={step.element.id} onClick={() => navigate.current(index)}>{label(step, index)}</button>)}</nav>}
      {status && <p className="story-runtime-status" role="status">{status}</p>}
    </div>
    <div className="story-steps"><Steps.Provider value={registry}>{children}</Steps.Provider></div>
  </section>;
}

export function Hero({ eyebrow, children, style, className }: { eyebrow?: string; children?: ReactNode; style?: CSSProperties; className?: string }) {
  return <header className={`story-hero ${className ?? ''}`} style={style}>{eyebrow && <p className="story-eyebrow">{eyebrow}</p>}{children}</header>;
}
export function Chapter({ id, children, wide = false, className, style }: { id?: string; children?: ReactNode; wide?: boolean; className?: string; style?: CSSProperties }) {
  return <section id={id} className={`story-chapter ${className ?? ''}`} style={style} data-wide={wide}>{children}</section>;
}
/** Keep one persistent authoring/control area inside the reading viewport. */
export function Sticky({ children, className, style }: { children?: ReactNode; className?: string; style?: CSSProperties }) {
  const reader = useContext(StoryReaderContext);
  const element = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = reader?.viewport.current;
    const node = element.current;
    if (!root || !node) return;
    const previousHeight = root.style.getPropertyValue('--story-sticky-height');
    const previousReaderHeight = root.style.getPropertyValue('--story-reader-height');
    const previousFlag = root.getAttribute('data-story-sticky');
    const measure = () => {
      root.style.setProperty('--story-reader-height', `${root.clientHeight}px`);
      root.style.setProperty('--story-sticky-height', `${node.getBoundingClientRect().height}px`);
    };
    root.setAttribute('data-story-sticky', 'true');
    const observer = new ResizeObserver(measure);
    observer.observe(node); observer.observe(root); measure();
    return () => {
      observer.disconnect();
      if (previousFlag === null) root.removeAttribute('data-story-sticky'); else root.setAttribute('data-story-sticky', previousFlag);
      if (previousHeight) root.style.setProperty('--story-sticky-height', previousHeight); else root.style.removeProperty('--story-sticky-height');
      if (previousReaderHeight) root.style.setProperty('--story-reader-height', previousReaderHeight); else root.style.removeProperty('--story-reader-height');
    };
  }, [reader]);
  return <div ref={element} className={`story-sticky ${className ?? ''}`} style={style}>{children}</div>;
}

export const storyComponents = { Scrolly, Step, Hero, Chapter, Story, Var, Range, DatePicker, Select, Value, Controls, StoryData, Show, Sticky };
