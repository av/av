# AGENTS.md

Guidance for coding agents working in this repository.
Last updated: 2026-03-08.

## Project Overview

- Static personal site: Parcel + Pug + SCSS + TypeScript.
- Main entry: `src/index.pug` / `src/index.ts`.
- Secondary entry: `src/harbor-qr.pug` (QR landing page).
- Blog entry: `src/blog/index.pug` + `src/blog/<slug>/index.pug` (generated).
- Interactive domains: intro, career timeline, skills map, contacts, footer.
- Rendering-heavy modules: `src/career/*` and `src/lib/*` (D3 + canvas).

## Rule Files

- `.cursor/rules/`: not present.
- `.cursorrules`: not present.
- `.github/copilot-instructions.md`: not present.

## Install and Environment

- `npm install` — install dependencies (`package-lock.json` is the lockfile).
- Do not use `yarn`; the repo is npm-only.
- Do not commit: `.parcel-cache/`, `dist/`, `node_modules/`, `src/blog/index.pug`,
  `src/blog/<slug>/`, `src/blog/.generated-manifest.json`, `public/sitemap.xml`,
  `public/rss.xml`, `public/robots.txt`.

## Build / Lint / Test Commands

```
npm run blog:generate       # generate blog pages + SEO artifacts from content/blog/*.md
npm run dev                 # blog:generate, then Parcel serve (all entries)
npm run dev:qr              # Parcel serve for QR page only
npm run build               # blog:generate → Parcel build → copy public/ → verify:grain
npm run verify:grain        # headless geometry gate (also runs at end of build)
npm run record:graph        # record a blog graph story from dist/ → docs/graph-story-demo.{mp4,webm,png}
npm run deploy              # rm dist/, npm run build, vercel --prod
npm run cache:bust          # rm -rf .parcel-cache
npm test                    # node:test suites: blog decor frontmatter + graph story validation
npx tsc --noEmit            # TypeScript static check
```

No ESLint or Prettier is configured. Static checks: `npm test` (blog decor
frontmatter in `scripts/blog/decor-config.test.mjs`, graph stories in
`scripts/blog/graph-story.test.mjs`) and `npx tsc --noEmit`.

## Repository Map

```
src/
  index.pug / index.ts    Primary entry + startup orchestration
  harbor-qr.pug           Standalone QR landing page entry
  intro/                  Procedural intro section (introSection.ts)
  career/                 Timeline: model, canvas viz, list fallback, ticks, event tags
  skills/                 D3 SVG skills map (SkillsSection.ts, skillList.ts)
  lib/                    Reusable primitives: Scene, PageSection, SmoothTransform,
                          InterpolatedValue, CanvasCursor, PointerTracker, SelectablePills
  lib/graph/              Animated graph story engine (types, story reducer, d3-force
                          layout with groups, SVG renderer, GraphStory controller)
  graph-story.scss        Styles for graph stories (imported by blog.scss)
  modals/                 Modal content Pug templates (*.pug)
  mixins/                 Shared Pug mixins: splitter, modal, fixed, floater, shape, intro-section
  types/                  Ambient TS declarations (modules.d.ts)
  blog/                   GENERATED — do not hand-edit; owned by blog:generate
  *.scss                  Section-level styles + shared vars/mixins
content/
  blog/                   Markdown source posts (author-facing); *.md files go here
  blog/graphs/            Graph story data (<name>.json) embedded by posts
scripts/
  blog/
    generate.mjs          Reads content/blog/*.md → writes src/blog/ pages + SEO artifacts
    graph-story.mjs       Finds graph-story markers, validates + inlines content/blog/graphs/*.json
    run-parcel.mjs        Reads manifest → spawns Parcel with explicit entrypoint list
  copy-public.mjs         Copies public/ into dist/ (recursive, dotfile-safe)
  record-graph-story.mjs  Plays a graph story in headless Chromium and records webm/mp4/poster
  deploy.sh               rm dist/, npm run build, cd dist, vercel --prod
public/                   Static files copied verbatim into dist/ at build time
```

## Blog Authoring Workflow

1. Create `content/blog/<any-name>.md`. The filename is arbitrary; the URL slug
   comes from the `slug` frontmatter field.
2. Add required frontmatter (all five fields are required):

   ```yaml
   ---
   title: "Post Title"
   date: "2026-03-08"          # ISO 8601 date or datetime
   description: "Short blurb"  # shown in index cards and meta tags
   slug: "url-slug"            # must match: ^[a-z0-9]+(?:-[a-z0-9]+)*$; must be unique
   tags:
     - tag-one
     - tag-two
   draft: true                 # optional; omit or set false to publish
   ---
   ```

   Optional background decor (`decor`):

   ```yaml
   # Pictogram gutters (default) — SVG sprites in left/right margins
   decor:
     seed: "my-post-slug"      # required; drives deterministic placement
     theme: default            # optional; pictogram theme from decor-themes.mjs
     count: 5                  # optional; 1–64 pictograms (default 16)
     type: pictogram           # optional; default when omitted

   # Generative canvas background — animated field behind content
   decor:
     seed: "my-post-slug"      # required; drives deterministic layout
     canvas: local-inference   # required; renderer kind (local-inference | asking | boids)
     color: cyan               # optional; Flexoki accent (red|orange|yellow|green|cyan|blue|purple|magenta)
     type: canvas              # optional when canvas is set; inferred automatically
   ```

   A shorthand string (`decor: "my-seed"`) is equivalent to pictogram decor with
   the default theme. If `canvas` is set to a valid kind, `type: canvas` is inferred
   even when `type` is omitted.

3. Run `npm run blog:generate` (or `npm run dev`, which runs it automatically).
4. The generator writes `src/blog/<slug>/index.pug`, updates `src/blog/index.pug`,
   regenerates `public/sitemap.xml`, `public/rss.xml`, `public/robots.txt`,
   and updates `src/blog/.generated-manifest.json`.
5. `draft: true` excludes the post from all output; stale slug directories from
   previously published posts are cleaned up automatically via the manifest.
6. Posts are sorted newest-first by date, then alphabetically by slug.
7. `SITE_URL` env var (default `https://av.codes`) sets base URL in canonical tags,
   sitemap, and RSS feed.

### Animated graph stories

Posts can embed an animated, step-by-step graph diagram (see
`docs/adr/0001-animated-graph-story-engine.md`):

1. Put the story in `content/blog/graphs/<name>.json` — a `GraphStorySpec`
   (`src/lib/graph/types.ts`): `steps[]`, each with `title`, `caption`, and either
   a full `state` (`nodes`, `edges`, `groups`) or `ops` applied to the previous
   step (`add` / `remove` / `set` / `move`). Objects keep identity by `id`.
2. Reference it from the markdown with a raw HTML marker:
   `<div class="graph-story" data-graph="<name>" data-trigger="click|scroll|timeline"></div>`
3. `npm run blog:generate` validates the story (dangling ids fail the build),
   inlines the JSON plus a no-JS fallback list, and adds `src/blog/graph.ts`
   to the page. Engine code lives in `src/lib/graph/`; keep it story-agnostic.
4. Steps may set `body` (a longer explanation, shown in scroll mode) and
   `focus` (`'all'` or a list of ids). Focus defaults to the ids a step's ops
   touch: the camera frames them and everything else dims.
5. Colour on the blog is greyscale plus green — `$gs-tones` in
   `src/graph-story.scss` collapses every accent onto three greys plus green,
   which is reserved for agentic nodes. Prefer `green` / `tx` / `tx2` / `tx3`
   in story data.

## TypeScript Configuration

`tsconfig.json` uses:
- `"moduleResolution": "node"` — required for extension-free local imports and
  bare package specifiers to resolve in `tsc`.
- `"allowSyntheticDefaultImports": true` — allows default imports from CommonJS
  packages (`micromodal`, `aos`, `chroma-js`) that lack a typed default export.

`src/types/modules.d.ts` declares `bundle-text:*` as a default `string` export.
This types the Parcel-specific `import csv from 'bundle-text:./file.csv'` imports
used in `src/career/timelineEvents.ts` and `src/skills/skillList.ts`.

## Code Style Guidelines

### General

- Match existing local style in touched files; keep diffs focused and minimal.
- Prefer readability over clever abstractions, especially in rendering code.
- Keep section orchestration in section modules/classes.
- Preserve existing comments unless clearly wrong.

### Imports and modules

- Use ESM (`import` / `export`) consistently.
- Import third-party packages first, then local modules, one import per line.
- No extension suffixes on local imports.
- Default exports for single primary classes/components; named exports for
  utilities, constants, and helper types.
- Two authoring styles coexist: class-based (`new CareerSection().init()`) for
  heavy section controllers, and procedural namespace imports
  (`import * as IntroSection from '...'`) for lighter sections. Match the style
  of the module being edited.
- D3 is typically imported as `import * as d3 from 'd3'`; named imports
  (`import { ScaleTime } from 'd3'`) also appear for specific type usage.

### TypeScript

- `PascalCase` for classes/interfaces/enums; `camelCase` for values/functions.
- Prefer explicit config interfaces for constructor parameters; keep them
  module-private (not exported).
- Class-scoped config: `static config = { ... }` passed as `ClassName.config`.
  DOM selector strings sometimes use `static selectors = { ... }` instead.
- Geometry-like values: reuse `Pair<T, K>`, `Offset`, `Rect` from `src/utils.ts`.
- `const` over `let` unless reassignment is required.
- Avoid `any`; when unavoidable, isolate it and add a comment explaining why
  (see `utils.ts` GistEmbed cast as the model).
- D3 generics: be specific — e.g. `d3.Selection<SVGGElement, Skill, SVGGElement, unknown>`,
  `d3.ZoomBehavior<Element, unknown>`, `d3.ScaleTime<number, number>`.
- Explicit return types when behavior is non-obvious or part of a public API.

### Formatting

- Semicolons everywhere.
- Single quotes (most common); match the quote style of the touched file.
- Trailing commas in multiline literals/calls where already used.
- No global reformatting of unrelated files.

### Naming and structure

- Section controllers: `<Name>Section`.
- Visual entities: role-based names (`TimelineVisualisation`, `TimeTick`, `Scene`).
- Parsing helpers: verb-first names (`parseCsv`, `parseDate`, `formatDateRange`).
- CSS classes: semantic, section-scoped names.

### DOM and interaction

- Prefer shared helpers from `src/utils.ts`: `qs`, `qsa`, `toggleDisplay`,
  `throttle`, `clamp`, `map`, `isPresent`, `scrollTo`, `showModal`, and others.
- Wire events in `init()`/`start()` methods.
- Use `requestAnimationFrame` loops for animation/render updates.
- Throttle expensive resize/scroll work.
- Keep pages navigable when JS-heavy enhancements are unavailable.

### Pug templates

- Compositional via `include` and `mixin`; do not convert to raw HTML.
- Shared mixins live in `src/mixins/`; modal content in `src/modals/`.
- Blog pages link `main.scss` and `blog.scss` separately — `blog.scss` is
  standalone and imports `vars.scss` directly, not via `main.scss`.
- Do not hand-edit generated files under `src/blog/`.

### SCSS

- Import variables and mixins from `src/vars.scss`.
- Section-specific files: `career.scss`, `skills.scss`, `blog.scss`, etc.
- Scope nested selectors under section roots to avoid global leakage.
- Available mixins: `@include media($bp)`, `@include center`,
  `@include adaptive-padding`, `@include splitter-glide`.
- Breakpoint tokens for `media()`: `sm`, `gt-sm`, `lt-md`, `md`, `gt-md`,
  `lt-md-mid`, `gt-md-mid`, `lg`.
- Reuse existing palette variables before adding new color constants.

### Error handling and robustness

- Validate optional runtime inputs (query params, dataset values, lookups).
- Guard DOM-dependent logic when elements may be absent.
- Fail fast on impossible states; avoid silent failure paths.
- Keep modal/query-string side effects explicit and reversible.
- Avoid `console.*` logging in production code paths.

## Change Validation Checklist

- Run the relevant build/dev command for the touched entry point(s).
- Run `npx tsc --noEmit` after any TypeScript change.
- Run `npm run verify:grain` after changes to grain clipping or splitter geometry
  (also runs automatically via `npm run build`).
- Manually verify affected UI on desktop and mobile widths.
- After adding/removing blog posts, run `npm run blog:generate` and verify
  `/blog/` index and the post route.
- If editing `src/career/*`: verify hover/click hit testing, zoom, and modal flow.
- If editing `src/skills/*`: verify map rendering, filtering, and zoom/pan.
- If editing `scripts/blog/generate.mjs` or `scripts/blog/run-parcel.mjs`:
  run `npm run build` end-to-end and check `dist/blog/` artifacts.

## Agent Guardrails

- Do not introduce new frameworks or build systems without explicit request.
- Do not rewrite large files only for style consistency.
- Do not edit files under `src/blog/` or `public/sitemap.xml|rss.xml|robots.txt`
  directly — they are owned by the generator.
- Do not edit generated output in `dist/` unless explicitly asked.
- Prefer small, reviewable changes over broad refactors.
- Update this file when adding/removing project commands or conventions.
