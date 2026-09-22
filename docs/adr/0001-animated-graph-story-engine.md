# ADR 0001: Animated graph story engine

Date: 2026-09-20. Status: accepted.

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
- **Layout: `d3-force`, warm-started per step, with a group-separation force.**
  The simulation runs synchronously (`tick(n)`) into a target layout and the
  renderer animates from the previous painted position to it. Node objects
  persist across steps, so unchanged nodes barely move. Groups get anchors
  (author-pinned or auto-distributed), members are pulled to their innermost
  group anchor, and sibling groups repel when their bounding boxes overlap.
  Group boxes are measured bottom-up so nesting works.
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
what the force layout separates (`boxCollide` pushes axis-aligned rectangles
apart along their shallower overlap), what group panels are measured from, and
what edges are trimmed against. Kind is carried by an ASCII sigil and the
corner treatment instead of a silhouette, which also suits the terminal look.

Cards are opaque, so an unavoidable overlap occludes cleanly rather than
turning into a tangle, and context is dimmed by darkening strokes and text
rather than by lowering opacity, which would let edges show through the cards.

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
- **ELK**: excellent compound-graph layouts but ~1 MB and async; overkill for
  storytelling diagrams with 20 nodes and would dominate the blog bundle.
- **dagre**: layered layout gives good DAGs but no compound groups in the
  maintained builds, and re-running it per step produces large jumps that break
  the "objects keep identity" feel.
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

- Layouts are deterministic per seed but force-based, so an author who wants a
  precise picture pins nodes or groups with `x`/`y` percentages.
- All steps are resolved and validated at build time; layouts are computed
  lazily on the client and cached per step, so going backwards replays the
  same geometry.
- Engine lives in `src/lib/graph/`, styles in `src/graph-story.scss`, blog
  bootstrap in `src/blog/graph.ts`. The engine has no knowledge of the story
  content.
