'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { basePath } from '@/lib/shared';

type Compiler = Awaited<ReturnType<typeof import('tailwindcss').compile>>;
let source: Promise<string> | undefined;
async function createCompiler(): Promise<Compiler> {
  source ??= fetch(`${basePath}/data/story/tailwind.css`).then(response => {
    if (!response.ok) throw new Error('Could not load the Story Tailwind theme.');
    return response.text();
  }).catch(error => { source = undefined; throw error; });
  const [{ compile }, css] = await Promise.all([import('tailwindcss'), source]);
  return compile(css);
}
function scopeTheme(css: string) {
  // Utility selectors are scoped by the compiler input. Its generated theme
  // variables and compatibility resets must also stay inside the reading pane.
  return css.replace(/^:root, :host \{$/gm, '.story-document {')
    .replace(/^(\s*)\*, ::before, ::after, ::backdrop \{$/gm,
      '$1.story-document *, .story-document ::before, .story-document ::after, .story-document ::backdrop {');
}

export function TailwindPreview({ children, onError }: { children?: ReactNode; onError(message: string): void }) {
  const root = useRef<HTMLDivElement>(null);
  const style = useRef<HTMLStyleElement>(null);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let disposed = false;
    let frame = 0;
    let running = false;
    let pending = false;
    let compiler: Compiler | undefined;
    const candidates = new Set<string>();
    async function update() {
      frame = 0;
      if (disposed) return;
      if (running) { pending = true; return; }
      let changed = false;
      for (const element of node!.querySelectorAll('[class]')) {
        for (const name of element.classList) {
          if (!candidates.has(name)) { candidates.add(name); changed = true; }
        }
      }
      if (!changed) return;
      running = true;
      try {
        compiler ??= await createCompiler();
        if (disposed) return;
        const css = scopeTheme(compiler.build([...candidates]));
        if (style.current) style.current.textContent = css;
      } catch (error) {
        candidates.clear();
        if (!disposed) onError(error instanceof Error ? error.message : String(error));
      } finally {
        running = false;
        if (pending && !disposed) { pending = false; schedule(); }
      }
    }
    function schedule() { if (!disposed && !frame) frame = requestAnimationFrame(() => { void update(); }); }
    const observer = new MutationObserver(schedule);
    observer.observe(node, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    schedule();
    return () => { disposed = true; observer.disconnect(); cancelAnimationFrame(frame); };
  }, [onError]);
  return <div ref={root} className="story-document"><style ref={style} data-story-tailwind="" />{children}</div>;
}
