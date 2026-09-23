# ADR 0001: Animated graph story engine

Date: 2026-09-20. Status: accepted. Layout revised 2026-09-23 (see
"Layered layout replaces the force layout").

## Context

Blog posts need diagrams that change as the story progresses: nodes and edges
appear, disappear and mutate, nodes move between groups, and all of it animates
instead of cutting between images. The site is a Parcel + Pug + SCSS +
TypeScript static build with D3 already in the bundle and no UI framework.
Posts are markdown compiled by `scripts/blog/generate.mjs`.

Requirements that drove the choice:

- identity-preserving transitions across steps (same node keeps its element);
- groups, including nesting, that are themselves animated;
- author writes the story as data, not code;
- small bundle, no framework, SSR-safe (the build never touches the DOM);
- `prefers-reduced-motion` respected.

## Decision

- **Renderer: SVG via D3 selections.** Node counts are small (tens), labels are
  first-class, and CSS custom properties give us the Flexoki palette and
  light/dark switching for free. Keyed data joins (`data(…, d => d.id)`) are
  exactly the identity model we need.
- **Animation: D3 transitions for geometry, CSS transitions for colour/state.**
  Positions, shape paths and group boxes are tweened with `d3-transition`.
  Every node shape is sampled to the same point count so a `d` string tweens
  into another when a node changes kind or size. Colours and states are CSS
  classes so the stylesheet owns the palette and the reduced-motion override.
- **Layout: ELK layered, top-down, in a web worker.** Groups are compound
  nodes, edges are routed orthogonally with fixed spacing, and edge labels
  are placed by the layout. Each step is laid out on its own and the renderer
  animates from the previous painted geometry to it. This replaced a
  warm-started `d3-force` layout; see below for why.
- **Data model: steps as full states or op lists.** `GraphStorySpec` in
  `src/lib/graph/types.ts`. Steps are resolved to full states first, then laid
  out on demand and cached. A build-time validator (`scripts/blog/graph-story.mjs`)
  mirrors the reducer so a dangling id fails `npm run blog:generate` instead of
  the reader's browser.
- **Embedding: HTML marker in markdown + JSON file.** Authors write
  `<div class="graph-story" data-graph="name" data-trigger="scroll|click|timeline"></div>`
  and keep the story in `content/blog/graphs/name.json`. The generator inlines
  the JSON and a plain `<ol>` fallback so the page stays readable without JS.

## Nodes are cards, not glyphs

A node is a box sized to its own text, with the label, a kind sigil and an
optional sublabel inside it. The first version drew a small shape with the
label floating underneath, which does not survive a dense graph: labels
collide with each other, with edges and with group panels, and no amount of
layout tuning fixes it because the label is not part of the thing being
laid out.

Making the label the node removes the whole class of problem. Card boxes are
what the layout places, what group panels are sized from, and where edge
routes start and end. Kind is carried by an ASCII sigil and the
corner treatment instead of a silhouette, which also suits the terminal look.

Cards are opaque, so an unavoidable overlap occludes cleanly rather than
turning into a tangle, and context is dimmed by darkening strokes and text
rather than by lowering opacity, which would let edges show through the cards.

## Layered layout replaces the force layout

The force layout kept cards apart (a positional separation pass after the
simulation made non-overlap an invariant) and routed long edges into evenly
spaced channel buses, but nothing in it knew where the *edges* were. By the
end of a long story, routes ran through cards, parallel runs landed on top of
each other and labels collided: the final frame of the tooling story had 21
routes through cards, 27 bunched pairs and 40 crossings. Tuning forces could
not fix it, because the edges were never part of what was laid out.

ELK's layered algorithm lays out cards, groups, routes and labels together:

- **Non-overlap and clear routes are guaranteed by construction.** Cards sit
  in layers with fixed gaps; routes are orthogonal and never cross a card;
  parallel runs are packed into lanes a fixed distance apart
  (`spacing.edgeEdge`), which is what the channel buses were approximating;
  edge labels are laid out as obstacles, so they cannot sit on a card, a
  route or another label.
- **Backward edges between groups are laid out forwards.** A compound group
  in a layered layout takes edges in on one side and out on the other, so an
  edge running back to an earlier group loops around the whole drawing. Each
  container's children are ordered by a greedy feedback-arc-set pass, and the
  few edges still running backwards are handed to ELK reversed and drawn the
  right way round. Every route is then short and forward.
- **Sibling order comes from the whole story, not the step.** The ordering
  weighs every edge that ever joins two siblings anywhere in the story, so
  two groups do not swap places because one step happens to show a
  different edge. Combined with ELK's model-order option (objects keep the
  order they were added in), a new card slots in beside the ones it arrived
  after and the rest of the picture holds still.
- **Longest-path layering, top-down.** Sources share the top layer, so
  sibling groups fed from the same place sit side by side instead of
  stacking; top-down keeps both stories close to the stage's shape
  (about 1.3:1) where left-to-right came out at nearly 4:1.
- **Group legends stay clear of routes.** A legend sits on its panel's top
  border and slides past any edge crossing it, falls back to the bottom
  border, and if neither has room the step is laid out again with space
  reserved beside the legend.
- **Deterministic and off the main thread.** A step's layout is a pure
  function of its state and the story, so replaying, scrolling back or jumping
  anywhere produce identical geometry. ELK runs in a worker, so the page has
  no long tasks while the reader scrolls; where workers are unavailable the
  bundled build runs on the main thread instead.

Routes animate by morphing: a route with the same number of corners moves
corner by corner and stays orthogonal throughout; otherwise both routes are
resampled by length and interpolated. `scripts/blog/graph-layout.test.mjs`
lays out every step of every story with the page's configuration and fails
on any overlap, route through a card, shared run or label collision.

What this costs: ELK is about 420 kB gzipped. It is loaded lazily, as a
worker, only on pages that embed a graph story, and it never touches the main
thread's budget. Author-pinned `x`/`y` positions and the layout `seed` no
longer mean anything and are ignored; the layered layout decides placement.

## Site theme: greyscale plus one accent

The engine supports the full Flexoki accent set, but the blog renders graph
stories in a monochrome theme (`$gs-tones` in `src/graph-story.scss`): three
greys plus green. Every accent a story uses collapses onto that vocabulary, so
no story can reintroduce hue on the site.

Green is reserved for what is *agentic* — agents and the infrastructure that
runs them. That makes the accent carry meaning rather than decoration: the
early steps of a story about adopting agents are pure greyscale, the first
green node is the first agent, and green spreads as agents take over the loop.
Phosphor bloom and the `active` glow are green-only for the same reason; grey
nodes stay flat. `error` reads as a broken outline rather than a red one.

## Alternatives rejected

- **Canvas renderer** (used by `src/career/*`): better for thousands of items,
  worse for text, hit-testing, accessibility and palette switching. Not needed
  at this scale.
- **ELK** (originally): rejected at first for its size and async API. Adopted
  on 2026-09-23 once dense stories showed that a force layout cannot keep
  routes and labels clean; the worker makes the async API free and keeps the
  size out of the main bundle.
- **dagre**: layered layout gives good DAGs but no compound groups in the
  maintained builds, and no edge-spacing or label-aware routing.
- **WebCola**: constraint layouts with groups fit well, but it is an extra
  ~100 kB, effectively unmaintained, and its group model fights the persistent
  identity approach less elegantly than warm-started `d3-force`.
- **GSAP**: strong tween engine, but an extra dependency with licensing terms
  for something `d3-transition` already covers.
- **Web Animations API**: cannot animate SVG geometry attributes (`d`, `x`,
  `width`) consistently across browsers; would have forced transform-only
  animations.
- **React/Svelte islands**: explicitly out of scope; the site has no framework.

## Consequences

- Placement is the layout's call, not the author's: the order objects are
  added in and the edges between them decide where they go.
- All steps are resolved and validated at build time; layouts are computed
  on demand in a worker, a few steps ahead of the reader, and cached per step,
  so going backwards replays the same geometry.
- Engine lives in `src/lib/graph/`, styles in `src/graph-story.scss`, blog
  bootstrap in `src/blog/graph.ts`. The engine has no knowledge of the story
  content.
