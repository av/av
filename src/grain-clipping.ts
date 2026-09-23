/** Matches $grain-tile-size in vars.scss (256px asset × 1.5). */
const GRAIN_TILE_SIZE = 384;

/** Grain band in .grain-layer coordinates (matches splitter ::after in splitter.scss). */
type GrainBand = { top: number; bottom: number };

let grainClipBound = false;
let grainClipSettleScheduled = false;
let grainClipResizeObserver: ResizeObserver | null = null;

function qs<T extends HTMLElement>(selector: string): T | null {
  return document.querySelector(selector);
}

function throttle(fn: () => void, delay: number): () => void {
  let last = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  return () => {
    const now = Date.now();
    const sinceLast = now - last;

    clearTimeout(timeout);

    if (sinceLast > delay) {
      last = now;
      fn();
    } else {
      timeout = setTimeout(() => {
        last = Date.now();
        fn();
      }, delay - sinceLast);
    }
  };
}

/**
 * Wires grain clipping for any page with `.grain-layer` and splitters or
 * graph stories. Safe to call from secondary entries (e.g. harbor-qr).
 */
export function initGrainClipping() {
  clipGrainAroundSplitters();
  scheduleGrainClipSettle();

  if (!grainClipBound) {
    grainClipBound = true;
    bindGrainClipListeners();
  }
}

function bindGrainClipListeners() {
  const reclip = throttle(clipGrainAroundSplitters, 100);
  window.addEventListener('resize', reclip);

  grainClipResizeObserver = new ResizeObserver(reclip);
  const grain = qs<HTMLElement>('.grain-layer');
  if (grain) {
    grainClipResizeObserver.observe(grain);
  }

  document.querySelectorAll('section.splitter, .graph-story').forEach((el) => {
    grainClipResizeObserver!.observe(el);
  });
}

/** One follow-up pass after fonts/layout settle (avoids triple init reclipping). */
function scheduleGrainClipSettle() {
  if (grainClipSettleScheduled) {
    return;
  }

  grainClipSettleScheduled = true;

  const settle = () => {
    grainClipSettleScheduled = false;
    requestAnimationFrame(clipGrainAroundSplitters);
  };

  if (document.fonts?.ready) {
    document.fonts.ready.then(settle).catch(settle);
  } else {
    window.addEventListener('load', settle, { once: true });
  }
}

/**
 * Punches splitter bands out of the global grain layer so only each
 * splitter's local ::after grain covers those pixels (no double grain).
 * Band spans the splitter border box, matching ::after (top:0 / bottom:0 in
 * splitter.scss); the cap band above keeps page-wide grain so the overlay
 * stays continuous even where the previous section occludes the local layer.
 */
export function clipGrainAroundSplitters() {
  const grain = qs<HTMLElement>('.grain-layer');
  const splitters = Array.from(document.querySelectorAll('section.splitter'));
  const stories = Array.from(document.querySelectorAll<HTMLElement>('.graph-story'));

  if (!grain) {
    return;
  }

  if (splitters.length === 0 && stories.length === 0) {
    grain.style.clipPath = 'none';
    return;
  }

  const grainRect = grain.getBoundingClientRect();
  const w = grainPathCoord(grainRect.width);
  const h = grainPathCoord(grainRect.height);
  let path = `M 0 0 H ${w} V ${h} H 0 Z`;

  for (const splitter of splitters) {
    const el = splitter as HTMLElement;
    const band = splitterGrainBand(el, grainRect);
    const bandTop = grainPathCoord(band.top);
    const bandBottom = grainPathCoord(band.bottom);
    path += ` M 0 ${bandTop} H ${w} V ${bandBottom} H 0 Z`;
    el.style.setProperty('--grain-bg-y', `${grainPhaseOffset(bandTop)}px`);
  }

  // Graph stories carry their own fixed grain (graph-story.scss). A scroll
  // story pins its figure while the page grain scrolls past, which reads as
  // noise crawling over the diagram, so the page grain skips the whole story.
  for (const story of stories) {
    const rect = story.getBoundingClientRect();
    const x0 = grainPathCoord(rect.left - grainRect.left);
    const x1 = grainPathCoord(rect.right - grainRect.left);
    const y0 = grainPathCoord(rect.top - grainRect.top);
    const y1 = grainPathCoord(rect.bottom - grainRect.top);
    path += ` M ${x0} ${y0} H ${x1} V ${y1} H ${x0} Z`;
  }

  grain.style.clipPath = `path(evenodd, '${path}')`;
}

/** Top/bottom of splitter ::after grain (border box) in .grain-layer coordinates. */
function splitterGrainBand(splitter: HTMLElement, grainRect: DOMRect): GrainBand {
  const rect = splitter.getBoundingClientRect();

  return {
    top: rect.top - grainRect.top,
    bottom: rect.bottom - grainRect.top
  };
}

/** Stable subpixel coords for SVG clip paths (avoids floor/ceil seam gaps). */
function grainPathCoord(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Aligns a splitter ::after tile phase with the page-wide grain layer. */
function grainPhaseOffset(docY: number): number {
  const mod = ((docY % GRAIN_TILE_SIZE) + GRAIN_TILE_SIZE) % GRAIN_TILE_SIZE;
  return -mod;
}