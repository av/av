export const prefersReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls = '',
  text?: string,
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function s<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

// Calls `cb(true)` when at least `ratio` of the element is on screen and
// `cb(false)` when it leaves.
export function watchVisible(el: Element, cb: (on: boolean) => void, ratio = 0.35): void {
  if (!('IntersectionObserver' in window)) {
    cb(true);
    return;
  }
  new IntersectionObserver((es) => es.forEach((e) => cb(e.isIntersecting)), { threshold: ratio }).observe(el);
}

// 0 when the element's top reaches `start` of the viewport height, 1 when it
// reaches `end`.
export function scrollProgress(el: Element, start = 0.85, end = 0.2): number {
  const r = el.getBoundingClientRect();
  const vh = window.innerHeight;
  const k = (vh * start - r.top) / (vh * (start - end));
  return Math.min(1, Math.max(0, k));
}

export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(`--fx-${name}`).trim();
}

export type ThemeColors = {
  tx: string;
  tx2: string;
  tx3: string;
  ui: string;
  bg: string;
  bg2: string;
  green: string;
  red: string;
};

export function readColors(): ThemeColors {
  return {
    tx: cssVar('tx') || '#100f0f',
    tx2: cssVar('tx2') || '#6f6e69',
    tx3: cssVar('tx3') || '#b7b5ac',
    ui: cssVar('ui') || '#e6e4d9',
    bg: cssVar('bg') || '#fffcf0',
    bg2: cssVar('bg2') || '#f2f0e5',
    green: cssVar('green') || '#66800b',
    red: cssVar('red') || '#af3029',
  };
}

export function createRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type CanvasController = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: () => number;
  height: () => number;
  colors: () => ThemeColors;
  redraw: () => void;
};

export function mountCanvas(
  stage: HTMLElement,
  heightFn: (w: number) => number,
  drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number, c: ThemeColors, t: number) => void,
  animated = true,
): CanvasController {
  const canvas = h('canvas', 'fxv-canvas');
  canvas.setAttribute('aria-hidden', 'true');
  stage.prepend(canvas);
  const ctx = canvas.getContext('2d')!;
  let W = 0;
  let H = 0;
  let cols = readColors();
  let raf = 0;
  let visible = false;
  let t0 = performance.now();

  const resize = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(260, stage.clientWidth || 680);
    H = heightFn(W);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = readColors();
  };

  const paint = (now = performance.now()) => {
    if (!W) resize();
    drawFn(ctx, W, H, cols, (now - t0) * 0.001);
  };

  const loop = (now: number) => {
    if (!visible) {
      raf = 0;
      return;
    }
    paint(now);
    raf = requestAnimationFrame(loop);
  };

  resize();
  paint();

  new ResizeObserver(() => {
    resize();
    paint();
  }).observe(stage);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    cols = readColors();
    paint();
  });

  if (animated && !prefersReduced()) {
    watchVisible(
      stage,
      (on) => {
        visible = on;
        if (on && !raf) raf = requestAnimationFrame(loop);
        if (!on && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      0.1,
    );
  }

  return {
    canvas,
    ctx,
    width: () => W,
    height: () => H,
    colors: () => cols,
    redraw: () => paint(),
  };
}
