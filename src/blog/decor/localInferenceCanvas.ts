import { createSeededRandom } from './seededRandom';

type Dir = 0 | 1 | 2 | 3;
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

type Turtle = { col: number; row: number; dir: Dir; phase: number };
type Seg = { x1: number; y1: number; x2: number; y2: number; birth: number; phase: number };

type Metrics = {
  width: number;
  height: number;
  dpr: number;
  mobile: boolean;
  reduced: boolean;
  zoneTop: number;
  zoneBot: number;
  drawH: number;
  cols: number;
  rows: number;
  cell: number;
  ox: number;
  oy: number;
};

const CELL = 14;
const STEP_MS = 50;
const FADE_MS = 2500;

function readColor(root: HTMLElement, varName: string): string {
  return getComputedStyle(root).getPropertyValue(`--fx-${varName}`).trim();
}

function measure(box: HTMLElement): Metrics {
  const rect = box.getBoundingClientRect();
  const mobile = rect.width < 768;
  const dpr = Math.min(mobile ? 1.25 : 2, window.devicePixelRatio || 1);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));

  const title = box.querySelector('.blog-title');
  const titleBot = title
    ? title.getBoundingClientRect().bottom - rect.top
    : mobile ? 100 : 130;

  const zoneTop = Math.max(10, titleBot - 60);
  const zoneBot = titleBot + (mobile ? 100 : 160);
  const drawH = Math.min(zoneBot + 30, h);

  const cols = Math.floor(w / CELL);
  const rows = Math.floor((zoneBot - zoneTop) / CELL);
  const ox = (w - cols * CELL) / 2;

  return { width: w, height: h, dpr, mobile, reduced, zoneTop, zoneBot, drawH, cols, rows, cell: CELL, ox, oy: zoneTop };
}

function buildTurtles(rand: () => number, m: Metrics, n: number): Turtle[] {
  const turtles: Turtle[] = [];
  for (let i = 0; i < n; i++) {
    turtles.push({
      col: Math.floor(rand() * m.cols),
      row: Math.floor(rand() * m.rows),
      dir: Math.floor(rand() * 4) as Dir,
      phase: rand() * Math.PI * 2,
    });
  }
  return turtles;
}

function stepTurtle(
  t: Turtle,
  m: Metrics,
  rand: () => number,
): { x1: number; y1: number; x2: number; y2: number } {
  const x1 = m.ox + t.col * m.cell + m.cell / 2;
  const y1 = m.oy + t.row * m.cell + m.cell / 2;

  const r = rand();
  let dir = t.dir;
  if (r < 0.25) dir = ((dir + 3) % 4) as Dir;
  else if (r < 0.50) dir = ((dir + 1) % 4) as Dir;

  let nc = t.col + DX[dir];
  let nr = t.row + DY[dir];

  if (nc < 0 || nc >= m.cols || nr < 0 || nr >= m.rows) {
    const valid: Dir[] = [];
    for (let d = 0; d < 4; d++) {
      const tc = t.col + DX[d];
      const tr = t.row + DY[d];
      if (tc >= 0 && tc < m.cols && tr >= 0 && tr < m.rows) valid.push(d as Dir);
    }
    if (valid.length > 0) {
      dir = valid[Math.floor(rand() * valid.length)];
      nc = t.col + DX[dir];
      nr = t.row + DY[dir];
    } else {
      return { x1, y1, x2: x1, y2: y1 };
    }
  }

  t.dir = dir;
  t.col = nc;
  t.row = nr;

  return {
    x1,
    y1,
    x2: m.ox + t.col * m.cell + m.cell / 2,
    y2: m.oy + t.row * m.cell + m.cell / 2,
  };
}

function warmup(
  turtles: Turtle[],
  m: Metrics,
  rand: () => number,
  steps: number,
): { segments: Seg[]; elapsed: number } {
  const segments: Seg[] = [];
  let elapsed = 0;
  for (let i = 0; i < steps; i++) {
    elapsed += STEP_MS;
    for (const t of turtles) {
      const c = stepTurtle(t, m, rand);
      segments.push({ ...c, birth: elapsed, phase: t.phase });
    }
  }
  return {
    segments: segments.filter(s => elapsed - s.birth < FADE_MS),
    elapsed,
  };
}

export function initLocalInferenceCanvas(
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
  const rand = createSeededRandom(`${seed}:walk`);
  let turtles = buildTurtles(createSeededRandom(`${seed}:init`), m, m.mobile ? 5 : 8);
  const warmupSteps = Math.ceil(FADE_MS / STEP_MS);

  let state = warmup(turtles, m, rand, warmupSteps);
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
    for (const s of segments) {
      const alpha = Math.max(0, 1 - (elapsed - s.birth) / FADE_MS) * 0.18;
      if (alpha <= 0) continue;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 2 + Math.sin(s.birth * 0.003 + s.phase) * 1.5;
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
      for (const t of turtles) {
        const c = stepTurtle(t, m, rand);
        segments.push({ ...c, birth: elapsed, phase: t.phase });
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
      const count = m.mobile ? 5 : 8;
      turtles = buildTurtles(createSeededRandom(`${seed}:init`), m, count);
      const refitRand = createSeededRandom(`${seed}:walk`);
      const w = warmup(turtles, m, refitRand, warmupSteps);
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
