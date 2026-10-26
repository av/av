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

export function watchVisible(el: Element, cb: (on: boolean) => void, ratio = 0.35): void {
  if (!('IntersectionObserver' in window)) {
    cb(true);
    return;
  }
  new IntersectionObserver((es) => es.forEach((e) => cb(e.isIntersecting)), { threshold: ratio }).observe(el);
}

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

// ---------------------------------------------------------------------------
// Precision Motion & Drafting Primitives
// ---------------------------------------------------------------------------

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
export const easeInOutCubic = (x: number) => {
  const t = clamp(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

export type Spring = {
  val: number;
  vel: number;
  target: number;
  step: (dt: number, stiffness?: number, damping?: number) => number;
  snap: (v: number) => void;
};

export function createSpring(initial: number): Spring {
  const sp: Spring = {
    val: initial,
    vel: 0,
    target: initial,
    step(dt: number, stiffness = 170, damping = 22) {
      const d = Math.min(dt, 0.05);
      const f = -stiffness * (sp.val - sp.target) - damping * sp.vel;
      sp.vel += f * d;
      sp.val += sp.vel * d;
      return sp.val;
    },
    snap(v: number) {
      sp.val = v;
      sp.target = v;
      sp.vel = 0;
    },
  };
  return sp;
}

// Draws subtle laboratory calibration grid + corner reticles on every canvas
export function drawBlueprint(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  c: ThemeColors,
  step = 28,
): void {
  ctx.save();
  ctx.fillStyle = c.tx3;
  ctx.globalAlpha = 0.22;
  const ox = (W % step) * 0.5;
  const oy = (H % step) * 0.5;
  for (let x = ox; x < W; x += step) {
    for (let y = oy; y < H; y += step) {
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  }

  // 4 corner reticles
  ctx.strokeStyle = c.tx3;
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 1;
  const m = 8;
  const len = 6;
  const corners: [number, number, number, number][] = [
    [m, m, 1, 1],
    [W - m, m, -1, 1],
    [m, H - m, 1, -1],
    [W - m, H - m, -1, -1],
  ];
  ctx.beginPath();
  for (const [cx, cy, dx, dy] of corners) {
    ctx.moveTo(cx, cy + dy * len);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx * len, cy);
  }
  ctx.stroke();
  ctx.restore();
}

// Draws a glowing telemetry node with concentric halo ring
export function drawGlowNode(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  haloAlpha = 0.2,
  haloScale = 2.6,
): void {
  ctx.save();
  if (haloAlpha > 0.01) {
    ctx.fillStyle = color;
    ctx.globalAlpha = haloAlpha;
    ctx.beginPath();
    ctx.arc(x, y, r * haloScale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Draws a clean pill badge around a canvas label so text never collides with lines
export function drawChip(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fg: string,
  bg: string,
  border: string,
  align: CanvasTextAlign = 'center',
): void {
  ctx.save();
  ctx.font = `500 10px 'Geist Pixel', ui-monospace, monospace`;
  const m = ctx.measureText(text);
  const pw = m.width + 12;
  const ph = 17;
  const rx = align === 'left' ? x : align === 'right' ? x - pw : x - pw * 0.5;
  const ry = y - ph * 0.5 - 1;

  ctx.fillStyle = bg;
  ctx.globalAlpha = 0.92;
  ctx.beginPath();
  ctx.roundRect(rx, ry, pw, ph, 3.5);
  ctx.fill();

  ctx.strokeStyle = border;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = fg;
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, rx + pw * 0.5, ry + ph * 0.5 + 0.5);
  ctx.restore();
}

export type CanvasController = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: () => number;
  height: () => number;
  colors: () => ThemeColors;
  pointer: { x: number; y: number; inside: boolean; down: boolean };
  redraw: () => void;
};

export function mountCanvas(
  stage: HTMLElement,
  heightFn: (w: number) => number,
  drawFn: (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    c: ThemeColors,
    t: number,
    dt: number,
    pointer: { x: number; y: number; inside: boolean; down: boolean },
  ) => void,
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
  const t0 = performance.now();
  let lastT = t0;
  const pointer = { x: 0.5, y: 0.5, inside: false, down: false };

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
    const dt = Math.min(0.05, Math.max(0.001, (now - lastT) * 0.001));
    lastT = now;
    drawBlueprint(ctx, W, H, cols);
    drawFn(ctx, W, H, cols, (now - t0) * 0.001, dt, pointer);
  };

  const loop = (now: number) => {
    if (!visible) {
      raf = 0;
      return;
    }
    paint(now);
    raf = requestAnimationFrame(loop);
  };

  const updatePointer = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = clamp((e.clientX - rect.left) / Math.max(1, rect.width));
    pointer.y = clamp((e.clientY - rect.top) / Math.max(1, rect.height));
  };

  stage.addEventListener('pointerenter', (e) => {
    pointer.inside = true;
    updatePointer(e);
  });
  stage.addEventListener('pointermove', (e) => {
    pointer.inside = true;
    updatePointer(e);
  });
  stage.addEventListener('pointerleave', () => {
    pointer.inside = false;
    pointer.down = false;
  });
  stage.addEventListener('pointerdown', (e) => {
    pointer.down = true;
    updatePointer(e);
  });
  window.addEventListener('pointerup', () => {
    pointer.down = false;
  });

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
        if (on && !raf) {
          lastT = performance.now();
          raf = requestAnimationFrame(loop);
        }
        if (!on && raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      },
      0.08,
    );
  }

  return {
    canvas,
    ctx,
    width: () => W,
    height: () => H,
    colors: () => cols,
    pointer,
    redraw: () => paint(),
  };
}
