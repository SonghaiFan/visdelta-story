'use client';

import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { CodeEditor } from '@/components/interactive/code-editor';
import { initialDocument, parseDocument, STORY_STORAGE_KEY, type StoryDocument } from './document';
import { storyExamples, findStoryExample, refreshExampleDraft, type StoryExample } from './examples';
import { SidebarProvider, StudioSidebar, StudioSidebarButton, useSidebar } from '@/components/studio/sidebar';
import { TailwindPreview } from './tailwind-preview';
import { StoryReaderContext, storyComponents } from './story-components';

const EXAMPLE_DRAFTS_KEY = 'visdelta.story.example-drafts.v1';

interface Preview { content: ReactNode; revision: number; }
interface GuardProps { preview: Preview; fallback: ReactNode; onError(message: string): void; onCommit(content: ReactNode): void; }
class PreviewGuard extends Component<GuardProps, { failed: boolean; revision: number }> {
  state = { failed: false, revision: this.props.preview.revision };
  static getDerivedStateFromProps(props: GuardProps, state: { revision: number }) {
    return props.preview.revision !== state.revision ? { failed: false, revision: props.preview.revision } : null;
  }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { this.props.onError(error.message); }
  render() {
    return this.state.failed ? this.props.fallback : <Commit content={this.props.preview.content} onCommit={this.props.onCommit} />;
  }
}
function Commit({ content, onCommit }: { content: ReactNode; onCommit(content: ReactNode): void }) {
  // Let descendant effects validate bindings before accepting a fallback.
  useEffect(() => {
    const timer = setTimeout(() => onCommit(content), 0);
    return () => clearTimeout(timer);
  }, [content, onCommit]);
  return content;
}

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function StoryStudio() {
  return <SidebarProvider><StoryStudioContent /></SidebarProvider>;
}
function caseUrl(id: string | null) {
  const url = new URL(location.href);
  if (id) url.searchParams.set('example', id); else url.searchParams.delete('example');
  url.hash = '';
  history.replaceState(null, '', url);
}
function StoryStudioContent() {
  const { mode, collapsed, setOpen } = useSidebar();
  const [selectedId, setSelectedId] = useState<string | null>('sales');
  const [query, setQuery] = useState('');
  const drafts = useRef(new Map<string, StoryDocument>());
  const [doc, setDoc] = useState<StoryDocument>(initialDocument);
  const [previousStory, setPreviousStory] = useState<{ doc: StoryDocument; auto: boolean; id: string | null } | null>(null);
  const [requested, setRequested] = useState<StoryDocument | null>(null);
  const [tab, setTab] = useState<'story' | 'code' | 'rows'>('story');
  const [auto, setAuto] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Preparing story…');
  const [saved, setSaved] = useState('');
  const viewport = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const dataFile = useRef<HTMLInputElement>(null);
  const [lastGood, setLastGood] = useState<ReactNode>(null);
  const revision = useRef(0);
  const lastRequest = useRef<StoryDocument | null>(null);
  const reader = useMemo(() => ({ viewport, reportError: setError }), []);
  const commit = useCallback((content: ReactNode) => { setLastGood(() => content); }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
    let restored = initialDocument;
    let restoredAuto = true;
    let restoredId: string | null = 'sales';
    try {
      const previous = localStorage.getItem(STORY_STORAGE_KEY);
      if (previous) {
        const draft = JSON.parse(previous);
        restored = parseDocument(draft);
        restoredAuto = draft.autoRun !== false;
        restoredId = findStoryExample(draft.exampleId)?.id ?? (restored.story === initialDocument.story ? 'sales' : null);
        restored = refreshExampleDraft(restoredId, restored, draft.exampleBase ? parseDocument(draft.exampleBase) : undefined);
      }
    } catch { /* A missing or unavailable local draft never prevents authoring. */ }
    try {
      const cached = JSON.parse(localStorage.getItem(EXAMPLE_DRAFTS_KEY) ?? '{}');
      for (const [id, value] of Object.entries(cached)) {
        if (findStoryExample(id)) {
          const entry = value as { exampleBase?: unknown };
          drafts.current.set(id, refreshExampleDraft(id, parseDocument(value), entry.exampleBase ? parseDocument(entry.exampleBase) : undefined));
        }
      }
    } catch { /* Invalid local case drafts do not prevent browsing examples. */ }
    const example = findStoryExample(new URLSearchParams(location.search).get('example'));
    if (restoredId) drafts.current.set(restoredId, restored);
    if (example) {
      if (restoredId !== example.id) setPreviousStory({ doc: restored, auto: restoredAuto, id: restoredId });
      setDoc(drafts.current.get(example.id) ?? example.document);
      setSelectedId(example.id); setAuto(restoredId === example.id ? restoredAuto : true);
      if (restoredId === example.id && !restoredAuto) setStatus('Draft restored. Press Run to preview.');
    } else {
      setDoc(restored); setAuto(restoredAuto); setSelectedId(restoredId);
      if (!restoredAuto) setStatus('Draft restored. Press Run to preview.');
    }
    setHydrated(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const timer = setTimeout(() => {
      try {
        if (selectedId) drafts.current.set(selectedId, doc);
        localStorage.setItem(STORY_STORAGE_KEY, JSON.stringify({ ...doc, autoRun: auto, exampleId: selectedId, exampleBase: findStoryExample(selectedId)?.document }));
        localStorage.setItem(EXAMPLE_DRAFTS_KEY, JSON.stringify(Object.fromEntries([...drafts.current].map(([id, draft]) => [id, { ...draft, exampleBase: findStoryExample(id)?.document }]))));
        setSaved('Draft saved on this device');
      }
      catch { setSaved('Use Save project to keep your work'); }
    }, 400);
    return () => clearTimeout(timer);
  }, [doc, auto, hydrated, selectedId]);
  useEffect(() => {
    if (!hydrated || !auto) return;
    const timer = setTimeout(() => { if (lastRequest.current !== doc) { setStatus('Updating preview…'); setRequested(doc); } }, 500);
    return () => clearTimeout(timer);
  }, [doc, auto, hydrated]);
  useEffect(() => {
    if (!requested) return;
    lastRequest.current = requested;
    let cancelled = false;
    const currentRevision = ++revision.current;
    void (async () => {
      try {
        const { compileStory } = await import('./compiler');
        const compiled = await compileStory(requested, storyComponents);
        // MDX recommends calling the compiled function for live editors, so a
        // prose edit does not replace the entire component tree and scroll root.
        const content = compiled.default({ components: storyComponents });
        if (!cancelled) {
          setPreview({ content, revision: currentRevision });
          setError(''); setStatus('Preview up to date');
        }
      } catch (cause) {
        if (!cancelled) { setError(cause instanceof Error ? cause.message : String(cause)); setStatus('Preview kept at the last valid version'); }
      }
    })();
    return () => { cancelled = true; };
  }, [requested]);

  const loadExample = (example: StoryExample) => {
    if (selectedId === example.id) { if (mode === 'drawer') setOpen(false); return; }
    if (selectedId) drafts.current.set(selectedId, doc);
    setPreviousStory(current => selectedId === null ? { doc, auto, id: null } : current ?? { doc, auto, id: selectedId });
    const next = drafts.current.get(example.id) ?? example.document;
    setDoc(next); setSelectedId(example.id); setTab('story');
    setError(''); setStatus('Updating preview…'); setRequested(next);
    caseUrl(example.id);
    viewport.current?.scrollTo({ top: 0 });
    if (mode === 'drawer') setOpen(false);
  };
  const restoreStory = () => {
    if (!previousStory) return;
    if (selectedId) drafts.current.set(selectedId, doc);
    setDoc(previousStory.doc); setAuto(previousStory.auto);
    setSelectedId(previousStory.id); caseUrl(previousStory.id);
    setRequested(previousStory.auto ? previousStory.doc : null);
    if (!previousStory.auto) setStatus('Story restored. Press Run to preview.');
    setPreviousStory(null);
  };
  const run = () => { setStatus('Updating preview…'); setRequested({ ...doc }); };
  const save = () => download('visdelta-story.json', JSON.stringify(doc, null, 2), 'application/json');
  async function openFile(selected?: File) {
    if (!selected) return;
    try {
      const text = await selected.text();
      const next = /\.mdx?$/i.test(selected.name) ? { ...doc, story: text } : parseDocument(JSON.parse(text));
      if (selectedId) drafts.current.set(selectedId, doc);
      setSelectedId(null); caseUrl(null);
      setAuto(false); setDoc(next); setTab('story'); setError('');
      setStatus('File opened. Press Run to preview its code.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    if (file.current) file.current.value = '';
  }
  async function openData(selected?: File) {
    if (!selected) return;
    try {
      const source = await selected.text();
      const rows = /\.csv$/i.test(selected.name)
        ? await import('d3').then(({ csvParse, autoType }) => csvParse(source, autoType))
        : JSON.parse(source);
      if (!Array.isArray(rows)) throw new Error('Choose a CSV table or a JSON array of records.');
      setDoc(current => ({ ...current, rows: JSON.stringify(rows, null, 2) })); setTab('rows');
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    if (dataFile.current) dataFile.current.value = '';
  }
  const label = tab === 'story' ? 'Story MDX' : tab === 'code' ? 'Chart code' : 'Story data';
  const filtered = storyExamples.filter(item => `${item.title} ${item.description} ${item.source}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="story-shell" data-collapsed={collapsed} data-sidebar-mode={mode}>
    <StudioSidebar title="Stories" floatingRestore={false}>
      <label className="mb-4 block">
        <span className="sr-only">Find a story</span>
        <input type="search" aria-label="Find a story" placeholder="Search stories…" value={query} onChange={event => setQuery(event.target.value)} className="h-9 w-full rounded-md border bg-fd-muted/50 px-2 text-sm outline-none focus:border-fd-ring" />
      </label>
      <nav aria-label="Story examples" className="story-examples">
        {filtered.map(example => <button key={example.id} aria-label={example.title} aria-current={selectedId === example.id ? 'page' : undefined} disabled={!hydrated} onClick={() => loadExample(example)}>
          <strong>{example.title}</strong><span>{example.description}</span><small>{example.source}</small>
        </button>)}
        {!filtered.length && <p className="p-2 text-sm text-fd-muted-foreground">No matching stories.</p>}
      </nav>
    </StudioSidebar>
    <div className="story-studio" data-reading={reading}>
    <header className="story-toolbar">
      <div className="story-toolbar-title">{(mode === 'drawer' || collapsed) && <span className="story-sidebar-toggle"><StudioSidebarButton /></span>}<strong>Story</strong><span>Words, data, and motion.</span></div>
      <div className="story-actions">
        {previousStory && <button onClick={restoreStory}>Restore previous story</button>}
        <label className="story-auto"><input type="checkbox" checked={auto} onChange={event => setAuto(event.target.checked)} /> Auto-run</label>
        <button onClick={run} title="Run (⌘/Ctrl + Enter)">Run</button>
        <button onClick={() => setReading(value => !value)} aria-pressed={reading}>{reading ? 'Edit story' : 'Read story'}</button>
        <button onClick={() => file.current?.click()}>Open</button>
        <button onClick={save}>Save project</button>
        <button onClick={() => download('story.mdx', doc.story, 'text/mdx')}>Export MDX</button>
        <input ref={file} type="file" accept=".json,.mdx,.md" hidden onChange={event => void openFile(event.target.files?.[0])} />
      </div>
    </header>
    <div className="story-workspace">
      <section className="story-editor" hidden={reading}>
        <div className="story-tabs" role="tablist" aria-label="Story files">{(['story', 'code', 'rows'] as const).map(name => <button id={`story-tab-${name}`} role="tab" aria-controls="story-editor-panel" aria-selected={tab === name} key={name} onClick={() => setTab(name)}>{name === 'story' ? 'story.mdx' : name === 'code' ? 'chart.js' : 'data.json'}</button>)}</div>
        <div id="story-editor-panel" role="tabpanel" aria-labelledby={`story-tab-${tab}`} className="story-editor-panel">
          <CodeEditor key={tab} ariaLabel={label} value={doc[tab]} onChange={value => setDoc(current => ({ ...current, [tab]: value }))} onRun={run} onSave={save} language={tab === 'story' ? 'markdown' : tab === 'code' ? 'javascript' : 'plain'} lineNumbers className="story-code" />
        </div>
        <div className="story-editor-tools"><button onClick={() => dataFile.current?.click()}>Import CSV / JSON</button><span>{saved}</span><input ref={dataFile} type="file" accept=".csv,.json" hidden onChange={event => void openData(event.target.files?.[0])} /></div>
        <details className="story-help"><summary>Writing with MDX</summary>
          <p>Write headings, paragraphs, links and lists as Markdown. Add chart steps with MDX components, and keep the VisDelta setup in <code>chart.js</code>. The weather story uses named <code>Step</code> views, shared <code>Value</code> fields and declarative controls.</p>
          <p><code>Hero</code> and <code>Chapter</code> frame the story. <code>Scrolly</code> groups steps; each <code>Step</code> pairs text with a complete chart state.</p>
          <p><code>{`<Scrolly layout="right" playback="step" chartStyle="paper">`}</code> plays when a step enters the reading area. Use <code>{'playback="scrub"'}</code> for scroll seeking. Layouts can be left, right or overlay. Steps accept <code>id</code> and <code>title</code> for navigation.</p>
          <p>Save project keeps MDX, code and data together. Export MDX saves the current source; its local imports still need their companion files.</p>
          <Link href="/docs/">Authoring guide ↗</Link>
        </details>
        <p className="story-trust">MDX runs JavaScript in your browser. Only run stories you trust.</p>
      </section>
      <section className="story-preview" aria-label="Story preview">
        <div className="story-preview-title"><span>Preview</span><span role="status">{status}</span></div>
        {error && <div className="story-error" role="alert">{error}</div>}
        <div ref={viewport} className="story-reader" tabIndex={0} aria-label="Story reading area" data-story-scroll="">
          <TailwindPreview onError={setError}><StoryReaderContext.Provider value={reader}>
            {preview && <PreviewGuard preview={preview} fallback={lastGood} onError={setError} onCommit={commit} />}
          </StoryReaderContext.Provider></TailwindPreview>
        </div>
      </section>
    </div>
  </div>
  </div>;
}
