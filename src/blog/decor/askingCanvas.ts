import { createSeededRandom } from './seededRandom';

type Grower = {
  x: number;
  y: number;
  angle: number;
  depth: number;
  phase: number;
  alive: boolean;
};

type Seg = {
  x1: number; y1: number;
  x2: number; y2: number;
  birth: number;
  depth: number;
  phase: number;
};

type Metrics = {
  width: number;
  height: number;
  dpr: number;
  mobile: boolean;
  reduced: boolean;
  zoneTop: number;
  zoneBot: number;
  drawH: number;
};

const STEP = 10;
const STEP_MS = 65;
const FADE_MS = 3200;
const BRANCH_P = 0.06;
const MAX_DEPTH = 4;
const MAX_BRANCHES = 28;
const JITTER = 0.12;
const DRIFT = 0.015;

function readColor(root: HTMLElement, v: string): string {
  return getComputedStyle(root).getPropertyValue(`--fx-${v}`).trim();
}

function measure(box: HTMLElement): Metrics {
  const rect = box.getBoundingClientRect();
  const mobile = rect.width < 768;
  const dpr = Math.min(mobile ? 1.25 : 2, window.devicePixelRatio || 1);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  const title = box.querySelector('.blog-title');
  const tBot = title
    ? title.getBoundingClientRect().bottom - rect.top
    : mobile ? 100 : 130;
  const zoneTop = Math.max(10, tBot - 120);
  const zoneBot = tBot + (mobile ? 240 : 360);
  return { width: w, height: h, dpr, mobile, reduced, zoneTop, zoneBot, drawH: Math.min(zoneBot + 30, h) };
}

function resetRoot(g: Grower, rand: () => number, m: Metrics): void {
  g.x = rand() * m.width;
  g.y = m.zoneTop + rand() * (m.zoneBot - m.zoneTop) * 0.25;
  g.angle = Math.PI / 2 + (rand() - 0.5) * Math.PI * 0.7;
  g.depth = 0;
  g.phase = rand() * Math.PI * 2;
  g.alive = true;
}

function buildRoots(rand: () => number, m: Metrics, n: number): Grower[] {
  return Array.from({ length: n }, () => {
    const g = {} as Grower;
    resetRoot(g, rand, m);
    return g;
  });
}

function stepGrower(
  g: Grower,
  branches: Grower[],
  m: Metrics,
  rand: () => number,
): Seg | null {
  if (!g.alive) return null;

  const x1 = g.x;
  const y1 = g.y;

  g.angle += (rand() - 0.5) * 2 * JITTER;
  g.angle += (Math.PI / 2 - g.angle) * DRIFT;

  g.x += Math.cos(g.angle) * STEP;
  g.y += Math.sin(g.angle) * STEP;

  if (g.x < -5 || g.x > m.width + 5 || g.y < m.zoneTop - 30 || g.y > m.zoneBot + 30) {
    g.alive = false;
    return null;
  }

  if (rand() < BRANCH_P && g.depth < MAX_DEPTH && branches.length < MAX_BRANCHES) {
    const sign = rand() < 0.5 ? 1 : -1;
    const spread = 0.35 + rand() * 0.4;
    branches.push({
      x: g.x,
      y: g.y,
      angle: g.angle + sign * spread,
      depth: g.depth + 1,
      phase: rand() * Math.PI * 2,
      alive: true,
    });
  }

  if (rand() < 0.003 + g.depth * 0.012) {
    g.alive = false;
  }

  return { x1, y1, x2: g.x, y2: g.y, birth: 0, depth: g.depth, phase: g.phase };
}

function simulate(
  roots: Grower[],
  branches: Grower[],
  m: Metrics,
  rand: () => number,
  steps: number,
): { segments: Seg[]; elapsed: number } {
  const segments: Seg[] = [];
  let elapsed = 0;

  for (let i = 0; i < steps; i++) {
    elapsed += STEP_MS;

    for (const r of roots) {
      if (!r.alive) { resetRoot(r, rand, m); continue; }
      const seg = stepGrower(r, branches, m, rand);
      if (seg) { seg.birth = elapsed; segments.push(seg); }
    }

    const bLen = branches.length;
    for (let j = 0; j < bLen; j++) {
      if (!branches[j].alive) continue;
      const seg = stepGrower(branches[j], branches, m, rand);
      if (seg) { seg.birth = elapsed; segments.push(seg); }
    }

    for (let j = branches.length - 1; j >= 0; j--) {
      if (!branches[j].alive) branches.splice(j, 1);
    }
  }

  return {
    segments: segments.filter(s => elapsed - s.birth < FADE_MS),
    elapsed,
  };
}

export function initAskingCanvas(
  canvas: HTMLCanvasElement,
  seed: string,
): () => void {
  const box = canvas.parentElement;
  if (!box) return () => {};
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const colorVar = canvas.dataset.decorColor || 'cyan';

  let m = measure(box);
  let color = readColor(document.documentElement, colorVar);
  const rand = createSeededRandom(`${seed}:grow`);
  const rootCount = m.mobile ? 4 : 6;
  let roots = buildRoots(createSeededRandom(`${seed}:init`), m, rootCount);
  let branches: Grower[] = [];
  const warmupSteps = Math.ceil(FADE_MS / STEP_MS);

  let state = simulate(roots, branches, m, rand, warmupSteps);
  let segments = state.segments;
  let elapsed = state.elapsed;
  let stepAccum = 0;
  let raf = 0;
  let last: number | null = null;
  let vis = true;
  let alive = true;
  let looping = false;

  const sizeCanvas = () => {
    const h = Math.min(m.drawH, m.height);
    canvas.width = Math.round(m.width * m.dpr);
    canvas.height = Math.round(h * m.dpr);
    canvas.style.width = `${m.width}px`;
    canvas.style.height = `${h}px`;
    canvas.style.bottom = 'auto';
    ctx.setTransform(m.dpr, 0, 0, m.dpr, 0, 0);
  };
  sizeCanvas();

  const draw = () => {
    const h = Math.min(m.drawH, m.height);
    ctx.clearRect(0, 0, m.width, h);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    const fadeStart = (m.zoneTop + m.zoneBot) * 0.5;
    const fadeRange = m.zoneBot - fadeStart;
    for (const s of segments) {
      const age = (elapsed - s.birth) / FADE_MS;
      const midY = (s.y1 + s.y2) * 0.5;
      const vFade = midY > fadeStart ? Math.max(0, 1 - (midY - fadeStart) / fadeRange) : 1;
      const alpha = Math.max(0, 1 - age) * (0.2 - s.depth * 0.025) * vFade;
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2.5 - s.depth * 0.35 + Math.sin(s.birth * 0.002 + s.phase) * 0.4;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  draw();

  const csQ = window.matchMedia('(prefers-color-scheme: dark)');
  const moQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const tabOk = () => document.visibilityState !== 'hidden';
  const canRun = () => alive && vis && tabOk() && !m.reduced;

  const halt = () => {
    if (looping) { cancelAnimationFrame(raf); looping = false; last = null; stepAccum = 0; }
  };

  const tick = (ts: number) => {
    if (!canRun()) { looping = false; return; }
    const dt = last === null ? 16 : Math.min(ts - last, 48);
    last = ts;
    stepAccum += dt;

    while (stepAccum >= STEP_MS) {
      stepAccum -= STEP_MS;
      elapsed += STEP_MS;

      for (const r of roots) {
        if (!r.alive) { resetRoot(r, rand, m); continue; }
        const seg = stepGrower(r, branches, m, rand);
        if (seg) { seg.birth = elapsed; segments.push(seg); }
      }

      const bLen = branches.length;
      for (let j = 0; j < bLen; j++) {
        if (!branches[j].alive) continue;
        const seg = stepGrower(branches[j], branches, m, rand);
        if (seg) { seg.birth = elapsed; segments.push(seg); }
      }

      for (let j = branches.length - 1; j >= 0; j--) {
        if (!branches[j].alive) branches.splice(j, 1);
      }
    }

    segments = segments.filter(s => elapsed - s.birth < FADE_MS);
    draw();
    raf = requestAnimationFrame(tick);
  };

  const go = () => {
    if (!canRun() || looping) return;
    looping = true;
    last = null;
    raf = requestAnimationFrame(tick);
  };

  const sync = () => {
    if (m.reduced) { halt(); draw(); return; }
    canRun() ? go() : halt();
  };

  const refit = () => {
    const next = measure(box);
    if (next.width !== m.width || next.height !== m.height || next.dpr !== m.dpr) {
      m = next;
      const n = m.mobile ? 4 : 6;
      roots = buildRoots(createSeededRandom(`${seed}:init`), m, n);
      branches = [];
      const refitRand = createSeededRandom(`${seed}:grow`);
      const w = simulate(roots, branches, m, refitRand, warmupSteps);
      segments = w.segments;
      elapsed = w.elapsed;
      stepAccum = 0;
      sizeCanvas();
      draw();
    }
  };

  const recolor = () => { color = readColor(document.documentElement, colorVar); draw(); };
  const remotion = () => { m = { ...m, reduced: moQ.matches }; sync(); };
  const onVis = () => sync();

  const io = new IntersectionObserver(
    (es) => { vis = es.some(e => e.isIntersecting); sync(); },
    { threshold: 0 },
  );
  io.observe(box);

  const ro = new ResizeObserver(() => { refit(); sync(); });
  ro.observe(box);

  csQ.addEventListener('change', recolor);
  moQ.addEventListener('change', remotion);
  document.addEventListener('visibilitychange', onVis);
  sync();

  return () => {
    alive = false;
    halt();
    io.disconnect();
    ro.disconnect();
    csQ.removeEventListener('change', recolor);
    moQ.removeEventListener('change', remotion);
    document.removeEventListener('visibilitychange', onVis);
  };
}
