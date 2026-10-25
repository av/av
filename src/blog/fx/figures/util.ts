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
