# Idyll and MDX: authoring research for Story

Research date: 2026-10-28. Primary-source findings and recommendations below are
separate. API sketches are proposals, not implemented VisDelta features.

## What is useful to borrow?

Idyll combines Markdown-like prose, components and document-level reactive
variables. Its introduction describes component properties bound to variables or
expressions and automatic re-rendering when dependencies change. The useful
writer experience is connecting a control, a sentence and a graphic through one
named value. [Idyll introduction](https://idyll-lang.org/docs)

MDX compiles Markdown/JSX into a component module and supports imports, props and
ordinary JSX composition. From this documented compilation model, a shared
reactive variable store is something the host/components provide; it is not
created automatically by writing a variable-like tag. This is an architectural
inference, not a claim that MDX forbids reactive applications.
[MDX usage](https://mdxjs.com/docs/using-mdx/)

Recommended division: **MDX for prose/composition; Story for reader state and
bindings; VisDelta for complete chart states and transitions.**

## Verified Idyll mechanisms

| Mechanism | Verified behavior | Source |
| --- | --- | --- |
| Variables and expressions | A named variable can bind to component properties; derived expressions recompute when dependencies change. Named datasets can load CSV/JSON, including asynchronous resources with initial values. | [Syntax](https://idyll-lang.org/docs/syntax) |
| Range | Moving a slider updates its bound variable; a Display can read that same variable. | [Range](https://idyll-lang.org/docs/component/range) |
| Custom React components | Injected `updateProps({ value: nextValue })` propagates a property update back to a bound document variable. The widget need not know the authored variable name. | [Custom components](https://idyll-lang.org/docs/components/custom) |
| Scroller | Separately exposes `currentStep`, `currentState`, per-step `progress` and an activation `offset`. A Step must declare a state for `currentState` to update. | [Scroller](https://idyll-lang.org/docs/component/scroller) |
| Viewport events and refs | Components can receive enter/exit events and references containing position/visibility information. | [Scrolling and refs](https://idyll-lang.org/docs/components/scrolling-and-refs) |
| Inline exploration | Dynamic displays support bounds/granularity; Action attaches click/hover behavior to text. | [Dynamic](https://idyll-lang.org/docs/component/dynamic), [Action](https://idyll-lang.org/docs/component/action) |
| Structured editor | Studio describes component/property panels, a variable sidebar and drag-to-bind authoring. | [Studio guide](https://github.com/idyll-lang/idyll-studio/blob/master/USER_GUIDE.md) |

An adapted equivalent of the documented Idyll Range example:

```text
[var name:"threshold" value:95 /]
[Range value:threshold min:0 max:100 /]
[Display value:threshold /]
```

The important capability is two-way binding through shared state, rather than
passing a static value into an isolated widget. This does not require copying
Idyll's bracket syntax or implementing another expression parser.

## What MDX already supports

The host can pass a `components` map to compiled MDX; official provider/injection
mechanisms can also supply shared components. Story can therefore make standard
controls available without repeated imports. Imported React components remain
an escape hatch. [MDX component injection](https://mdxjs.com/guides/injecting-components/)

A JSX expression such as `{threshold}` uses normal JavaScript lexical scope.
Declaring `<Var name="threshold" />` would **not** make that expression reactive
or even declare a lexical `threshold`. Likewise, `bind="threshold"` is just a
string until a Story component gives it explicit binding behavior. Prefer a
named control binding and an explicit `<Value name="threshold" />` reader.

## Recommended next step for VisDelta

The weather simplification moved code out of MDX, but its original control panel
was still a fixed part of a domain-specific Weather wrapper. The next useful
abstraction is small, reusable controls that writers can place in MDX, backed by
one document-scoped value store.

Current implementation pointers: [weather MDX template](../../components/story/weather-demo.ts),
[fixed Weather controls](../../components/story/weather-story.tsx), and
[MDX module/component resolution](../../components/story/compiler.ts).

Illustrative target only; none of these proposed binding tags are implemented by
this research note:

```mdx
<Story>

<Var name="threshold" value={95} />

# How unusual was that day?

Keep days above percentile <Value name="threshold" />.

<Range bind="threshold" label="Percentile" min={0} max={100} />

<WeatherStep view="extreme">

## Focus on unusual days

Raise the threshold to keep fewer observations.

</WeatherStep>

</Story>
```

Here the writer chooses control placement and writes the explanation. The
reusable control owns its browser handler; Story owns the value; a weather
adapter consumes the value snapshot and constructs native VisDelta states.
The Weather adapter would need explicit integration with that store.

Do not silently reinterpret the existing `Step chart` prop as a string lookup:
it currently receives a native chart state. Named chart references would require
a separately designed resolver and validation; they are not an existing feature.

Start with a value scope, range/date/select controls and an inline value display.
Keep derived observations, counts and chart construction as ordinary functions in
a companion module. A dependency graph, expression evaluator, visual editor or
new parser is unnecessary for this first improvement.

| Concern | Recommended owner |
| --- | --- |
| Prose, control placement, step order | MDX |
| Reader-selected date, percentile, station, measure | Story state |
| Input events, validation and accessibility | Reusable controls |
| Loading and domain calculations | Companion module / example adapter |
| Complete keyed chart states | VisDelta builders |
| Differences, planning and frames | VisDelta runtime |
| Step-enter playback or optional scrub progress | Story control layer |

A step-enter event should remain distinct from animation progress. It can start
a timed transition, while continuous scroll progress remains an optional control.
This borrows the useful separation in Idyll's Scroller without changing Core.

Acceptance checks for a future implementation:

- Two controls, an inline value and the actual chart observe the same value.
- Moving/removing a control requires only an MDX edit.
- Prose edits preserve reader selections; changed declared defaults update them.
- Story scopes are isolated; unknown bindings, duplicate declarations and invalid
  values produce readable errors.
- Reverse/skip retargeting, reduced motion and custom React components still work.

## Licensing and evidence limits

The main Idyll repository is MIT licensed, including its notice-preservation
condition for copies or substantial portions. No implementation is copied by
this note, and this license should not be assumed to cover every separate
organisation repository. [Idyll license](https://raw.githubusercontent.com/idyll-lang/idyll/master/LICENSE)

Studio's guide calls it a work in progress, warns about missing autosave and
notes incomplete default component configurations. These are guide statements,
not verification of a current binary. No Idyll installation was run here, and
maintenance/compatibility is not inferred from commit dates. The old standalone
compiler explicitly says its code moved to the main monorepo; its archived
status does not establish that the current project is archived.
[Studio guide](https://github.com/idyll-lang/idyll-studio/blob/master/USER_GUIDE.md),
[Compiler migration notice](https://github.com/idyll-lang/idyll-compiler)

## Implemented first slice

Story now provides scoped variables, Range/DatePicker/Select bindings, inline
Value, and a useStoryVariable hook. The short weather example declares controls
in MDX and binds native VisDelta chart views to the same values. This uses MDX
and React directly, without an Idyll runtime or a new expression language. See
[the MDX guide](../authoring.mdx).
