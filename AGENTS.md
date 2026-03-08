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
npm run build               # blog:generate → Parcel build → copy public/ into dist/
npm run deploy              # rm dist/, npm run build, vercel --prod
npm run cache:bust          # rm -rf .parcel-cache
npx tsc --noEmit            # TypeScript static check (no test runner exists)
```

No ESLint, Prettier, or test framework is configured. `npx tsc --noEmit` is the
only static check. Future tests: `npx vitest run path/to/file.test.ts -t "name"`.

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
  modals/                 Modal content Pug templates (*.pug)
  mixins/                 Shared Pug mixins: splitter, modal, fixed, floater, shape, intro-section
  types/                  Ambient TS declarations (modules.d.ts)
  blog/                   GENERATED — do not hand-edit; owned by blog:generate
  *.scss                  Section-level styles + shared vars/mixins
content/
  blog/                   Markdown source posts (author-facing); *.md files go here
scripts/
  blog/
    generate.mjs          Reads content/blog/*.md → writes src/blog/ pages + SEO artifacts
    run-parcel.mjs        Reads manifest → spawns Parcel with explicit entrypoint list
  copy-public.mjs         Copies public/ into dist/ (recursive, dotfile-safe)
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

3. Run `npm run blog:generate` (or `npm run dev`, which runs it automatically).
4. The generator writes `src/blog/<slug>/index.pug`, updates `src/blog/index.pug`,
   regenerates `public/sitemap.xml`, `public/rss.xml`, `public/robots.txt`,
   and updates `src/blog/.generated-manifest.json`.
5. `draft: true` excludes the post from all output; stale slug directories from
   previously published posts are cleaned up automatically via the manifest.
6. Posts are sorted newest-first by date, then alphabetically by slug.
7. `SITE_URL` env var (default `https://av.codes`) sets base URL in canonical tags,
   sitemap, and RSS feed.

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
