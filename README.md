# VisDelta Story

An independent MDX authoring application built on VisDelta's public API.
It owns the editor, article layout, scroll activation, reactive variables and
controls. VisDelta owns chart declarations, rendering and transitions.

## Run

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:4322/story/ (the root also opens the editor).
No VisDelta checkout, website build, source alias or filesystem link is needed.
`npm run build && npm start` serves a production static export on the same port.

## Author

- `story.mdx`: Markdown, HTML, JSX, native VisDelta declarations and imports.
- `chart.js`: a chart declaration or a pure model with named `views`, derived
  `values` and `conditions`. Factories, D3 and `rows` are supplied by the editor.
- `data.json`: editable records; CSV/JSON import is supported.

The sidebar includes Sales, Energy and the complete archived Melbourne weather
case study. Entering a Step triggers playback; reverse scrolling, scrub mode,
step navigation, hashes, reduced motion and responsive reading are preserved.
`Story`, `Var`, `Range`, `DatePicker`, `Select`, `Value`, `StoryData` and `Show`
provide declarative controls/prose/chart binding. Native HTML, inline styles,
live Tailwind classes and custom React components are supported. `Sticky`
coordinates controls with the chart position.

Auto-run/manual Run, recoverable error previews, per-case browser drafts,
project save/open, MDX export and data import retain the existing version-1
project format. Imported projects wait for Run. Only run trusted MDX/JavaScript.
Browser drafts do not automatically cross origins: download old drafts from
the VisDelta website's `/story/` entry and Open those JSON files here.

Live: https://songhaifan.github.io/visdelta-story/story/

Documentation: https://songhaifan.github.io/visdelta-story/docs/

See [the complete authoring reference](docs/authoring.mdx), the independent Fumadocs site at `/docs/` (sidebar, static search, contents and Markdown exports),
[weather evidence](docs/case-studies/weather-analysis.md) and
[data provenance and limits](data/weather/README.md).
The archive is local historical data, not live weather. Missing observations
remain missing; other stations never silently substitute Melbourne data.

## Public package boundary

`visdelta` is an actual installed package, not `file:../visdelta`, a workspace
symlink, a TypeScript path alias, or a copied renderer. Imports use only its
package `exports`: chart factories, types, `render`, `transition`, chart styles
and stylesheet. `npm run boundary:check` enforces that boundary and exercises
an installed-package consumer. Browser tests exercise the real native renderer.

`vendor/visdelta-0.4.2.tgz` is the public-package snapshot packed from the sibling
checkout at extraction time. It includes only the library's distribution and
published files, with its MIT license. This makes this project self-contained
and reproducible without assuming that npm's version 0.4.2 matches this local
build. It does not mean a new npm release has been published. Its exact integrity
is pinned in package-lock.json. To upgrade, install a tested published version
(`npm install --save-exact visdelta@VERSION`) or install a new packed public
artifact, then rerun the full checks. Do not alias imports to library source.

## Checks

```sh
npm run lint
npm run types:check
npm run boundary:check
npm run analyze:weather
npm run build
npm test
```

Browser tests use the frozen `out/` build on port 4323, one worker. Install
Playwright Chromium, or set `VISDELTA_CHROME_PATH` to an existing Chrome binary.
Do not rebuild while browser tests run. Tests cover MDX editing/imports/errors,
save/open/export, generic bindings, native chart playback, weather data claims,
slider latency, live Tailwind, sticky controls and desktop/mobile navigation.

## Deploy and connect the official website

Deploy `out/` to a static host. For a subpath build, for example GitHub Pages:

```sh
STORY_BASE_PATH=/visdelta-story npm run build
```

Asset loading, Tailwind theme, weather fetches, Next links and the static test
server honor the recorded base path. The official VisDelta website retains
`/story/` and its navigation entry. Build that website with
`NEXT_PUBLIC_STORY_URL=https://YOUR_HOST/YOUR_BASE/story/` to point to this app.
The entry preserves `?example=` and the story hash and offers old draft downloads.
A deployment is not performed by creating or building this project.
