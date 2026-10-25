import { createSeededRandom } from './seededRandom';

// A code minimap that is always being edited: rows of grey token blocks where
// hunks keep turning red, shrinking away, and coming back green. The canvas is
// pinned to the viewport. Below the header it only paints the gutters beside
// the text column; on phones, where there are no gutters, it shrinks to an
// editor-style change bar on each edge.

type Metrics = {
  width: number;
  height: number;
  dpr: number;
  mobile: boolean;
  reduced: boolean;
  colL: number;
  colR: number;
  headerBottom: number;
  pitch: number;
  block: number;
  laneW: number;
  laneGap: number;
  lanes: number[];
};

type Hunk = {
  lane: number;
  row: number;
  len: number;
  t0: number;
  id: number;
};

type Palette = { tx: string; red: string; green: string };

const DEL_MS = 1500;
const ADD_MS = 900;
const SETTLE_MS = 3200;
const HUNK_MS = DEL_MS + ADD_MS + SETTLE_MS;
const PARALLAX = 0.35;
const FRAME_MS = 1000 / 30;
const EDGE_PAD = 28;
const FADE_PX = 56;

function hash(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function seedNumber(seed: string): number {
  return Math.floor(createSeededRandom(seed)() * 2 ** 31);
}

// Token widths for one line of fake code, laid out from the line's indent.
function lineTokens(base: number, lane: number, row: number, version: number, maxW: number): number[] {
  const r = (k: number) => hash(base + version * 7919, lane * 131 + k, row);
  if (r(0) < 0.12) return [];
  const indent = Math.max(0, Math.round(1.6 + 1.5 * Math.sin(row * 0.23 + lane * 1.7) + (r(1) - 0.5) * 1.4));
  const out: number[] = [indent * 9];
  let x = indent * 9;
  const n = 1 + Math.floor(r(2) * 5);
  for (let i = 0; i < n; i++) {
    const w = 6 + Math.floor(r(3 + i) * (i === 0 ? 34 : 46));
    if (x + w > maxW) break;
    out.push(w);
    x += w + 4;
  }
  return out;
}

function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const get = (v: string) => cs.getPropertyValue(`--fx-${v}`).trim();
  return { tx: get('tx3'), red: get('red'), green: get('green') };
}

function measure(box: HTMLElement): Metrics {
  const width = document.documentElement.clientWidth || window.innerWidth;
  const height = window.innerHeight;
  const mobile = width < 768;
  const content = box.querySelector('.blog-content') ?? box.querySelector('.blog-shell');
  const rect = content?.getBoundingClientRect();
  const colL = rect ? rect.left : width * 0.2;
  const colR = rect ? rect.right : width * 0.8;
  const headerBottom = rect ? rect.top + window.scrollY - 12 : 320;
  const laneW = mobile ? 150 : 210;
  const laneGap = mobile ? 18 : 30;
  const lanes: number[] = [];
  for (let x = mobile ? 10 : 18; x < width; x += laneW + laneGap) lanes.push(x);
  return {
    width,
    height,
    dpr: Math.min(mobile ? 1.5 : 2, window.devicePixelRatio || 1),
    mobile,
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    colL,
    colR,
    headerBottom,
    pitch: mobile ? 9 : 11,
    block: mobile ? 3 : 4,
    laneW,
    laneGap,
    lanes,
  };
}

export function initDiffCanvas(canvas: HTMLCanvasElement, seed: string): () => void {
  const box = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  if (!box || !ctx) return () => {};

  const base = seedNumber(`${seed}:diff`);
  const rand = createSeededRandom(`${seed}:hunks`);
  const versions = new Map<string, number>();
  let hunks: Hunk[] = [];
  let hunkId = 0;
  let m = measure(box);
  let pal = readPalette();
  let now = 0;
  let raf = 0;
  let lastFrame = 0;
  let alive = true;

  Object.assign(canvas.style, { position: 'fixed', top: '0', left: '0', bottom: 'auto', right: 'auto' });

  const size = () => {
    canvas.width = Math.round(m.width * m.dpr);
    canvas.height = Math.round(m.height * m.dpr);
    canvas.style.width = `${m.width}px`;
    canvas.style.height = `${m.height}px`;
  };
  size();

  const rowOffset = () => (m.reduced ? 0 : window.scrollY * PARALLAX);
  const headerScreenBottom = () => m.headerBottom - window.scrollY;

  // Regions of the viewport the field may paint, as [x0, x1, y0, y1].
  const regions = (): [number, number, number, number][] => {
    const hb = Math.max(0, Math.min(m.height, headerScreenBottom()));
    const out: [number, number, number, number][] = [];
    if (hb > 0) out.push([0, m.width, 0, hb]);
    if (m.mobile) {
      out.push([0, 9, hb, m.height], [m.width - 9, m.width, hb, m.height]);
    } else {
      if (m.colL - EDGE_PAD > 0) out.push([0, m.colL - EDGE_PAD, hb, m.height]);
      if (m.colR + EDGE_PAD < m.width) out.push([m.colR + EDGE_PAD, m.width, hb, m.height]);
    }
    return out;
  };

  const visibleRows = () => {
    const off = rowOffset();
    return { first: Math.floor(off / m.pitch), last: Math.ceil((off + m.height) / m.pitch), off };
  };

  const spawn = () => {
    const regs = regions();
    if (regs.length === 0) return;
    const [x0, x1, y0, y1] = regs[Math.floor(rand() * regs.length)];
    if (y1 - y0 < m.pitch * 4) return;
    const strip = x1 - x0 < 20;
    const lanes = strip
      ? [{ i: x0 === 0 ? 0 : 1 }]
      : m.lanes.map((x, i) => ({ x, i })).filter(({ x }) => x + 40 > x0 && x < x1);
    if (lanes.length === 0) return;
    const lane = lanes[Math.floor(rand() * lanes.length)].i;
    const off = rowOffset();
    const row = Math.floor((off + y0 + rand() * (y1 - y0 - m.pitch * 3)) / m.pitch);
    const len = 1 + Math.floor(rand() * (m.mobile ? 3 : 5));
    if (hunks.some((h) => h.lane === lane && row < h.row + h.len + 2 && h.row < row + len + 2)) return;
    hunks.push({ lane, row, len, t0: now, id: hunkId++ });
  };

  const hunkAt = (lane: number, row: number) =>
    hunks.find((h) => h.lane === lane && row >= h.row && row < h.row + h.len);

  const drawField = () => {
    const { first, last, off } = visibleRows();
    const neutralA = 0.2;
    for (let li = 0; li < m.lanes.length; li++) {
      const lx = m.lanes[li];
      for (let row = first; row <= last; row++) {
        const y = row * m.pitch - off;
        const key = `${li}:${row}`;
        const version = versions.get(key) ?? 0;
        const h = hunkAt(li, row);
        let tokens = lineTokens(base, li, row, version, m.laneW);
        let color = pal.tx;
        let alpha = neutralA;
        let reveal = 1;
        let band: string | null = null;
        let bandA = 0;

        if (h) {
          const t = now - h.t0;
          const stagger = (row - h.row) * 90;
          if (t < DEL_MS) {
            const k = Math.min(1, Math.max(0, (t - stagger) / 420));
            color = pal.red;
            alpha = neutralA + (0.62 - neutralA) * k;
            reveal = 1 - Math.min(1, Math.max(0, (t - 600 - stagger) / 600));
            band = pal.red;
            bandA = 0.1 * k;
          } else {
            tokens = lineTokens(base, li, row, version + 1, m.laneW);
            const ta = t - DEL_MS;
            reveal = Math.min(1, Math.max(0, (ta - stagger) / (ADD_MS - 300)));
            const settle = Math.min(1, Math.max(0, (ta - ADD_MS) / SETTLE_MS));
            color = settle < 1 ? pal.green : pal.tx;
            alpha = 0.66 - (0.66 - neutralA) * settle;
            band = pal.green;
            bandA = 0.1 * (1 - settle);
          }
        }

        if (band && bandA > 0) {
          ctx.globalAlpha = bandA;
          ctx.fillStyle = band;
          ctx.fillRect(lx - 6, y - 2, m.laneW + 8, m.pitch);
          ctx.globalAlpha = Math.min(1, bandA * 6);
          ctx.fillRect(lx - 6, y - 2, 2, m.pitch);
        }

        if (tokens.length < 2) continue;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        let x = lx + tokens[0];
        const total = tokens.slice(1).reduce((s, w) => s + w + 4, 0);
        let budget = total * reveal;
        for (let i = 1; i < tokens.length && budget > 0; i++) {
          const w = Math.min(tokens[i], budget);
          ctx.fillRect(x, y, w, m.block);
          budget -= tokens[i] + 4;
          x += tokens[i] + 4;
        }
      }
    }
  };

  // On phones the gutters only hold a change bar: one tick per row, coloured
  // by whatever hunk currently covers it.
  const drawChangeBars = () => {
    const { first, last, off } = visibleRows();
    const hb = Math.max(0, headerScreenBottom());
    for (let row = first; row <= last; row++) {
      const y = row * m.pitch - off;
      if (y < hb) continue;
      for (const [x, li] of [[3, 0], [m.width - 6, 1]] as const) {
        const h = hunkAt(li, row);
        if (!h) {
          if (hash(base, li, row) < 0.55) continue;
          ctx.globalAlpha = 0.28;
          ctx.fillStyle = pal.tx;
        } else {
          const t = now - h.t0;
          const settle = t < DEL_MS ? 0 : Math.min(1, (t - DEL_MS - ADD_MS) / SETTLE_MS);
          ctx.globalAlpha = 0.75 * (1 - Math.max(0, settle));
          ctx.fillStyle = t < DEL_MS ? pal.red : pal.green;
        }
        ctx.fillRect(x, y, 3, m.pitch - 3);
      }
    }
  };

  const fadeEdges = () => {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    const hb = headerScreenBottom();
    if (hb > -FADE_PX && hb < m.height + FADE_PX && !m.mobile) {
      const g = ctx.createLinearGradient(0, hb - FADE_PX * 2, 0, hb);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.fillStyle = g;
      ctx.fillRect(m.colL - EDGE_PAD, hb - FADE_PX * 2, m.colR - m.colL + EDGE_PAD * 2, FADE_PX * 2);
    }
    if (!m.mobile) {
      for (const [edge, dir] of [[m.colL - EDGE_PAD, -1], [m.colR + EDGE_PAD, 1]] as const) {
        const g = ctx.createLinearGradient(edge, 0, edge + dir * FADE_PX, 0);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        const x = dir < 0 ? edge - FADE_PX : edge;
        ctx.fillRect(x, Math.max(0, hb), FADE_PX, m.height);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  };

  const draw = () => {
    ctx.setTransform(m.dpr, 0, 0, m.dpr, 0, 0);
    ctx.clearRect(0, 0, m.width, m.height);
    ctx.save();
    ctx.beginPath();
    const regs = regions();
    const fieldRegs = m.mobile ? regs.filter(([, , y0]) => y0 === 0) : regs;
    for (const [x0, x1, y0, y1] of fieldRegs) ctx.rect(x0, y0, x1 - x0, y1 - y0);
    ctx.clip();
    if (fieldRegs.length > 0) drawField();
    ctx.restore();
    if (m.mobile) drawChangeBars();
    fadeEdges();
    ctx.globalAlpha = 1;
  };

  const step = () => {
    for (const h of hunks) {
      if (now - h.t0 >= HUNK_MS) {
        for (let r = h.row; r < h.row + h.len; r++) {
          const key = `${h.lane}:${r}`;
          versions.set(key, (versions.get(key) ?? 0) + 1);
        }
      }
    }
    hunks = hunks.filter((h) => now - h.t0 < HUNK_MS);
    const target = m.mobile ? 4 : 7;
    if (hunks.length < target && rand() < 0.08) spawn();
  };

  // Seed a still frame with hunks at different stages so the first paint
  // already looks mid-edit, and reduced-motion users get a static diff.
  const warm = () => {
    now = 0;
    hunks = [];
    for (let i = 0; i < 400; i++) {
      now += 50;
      step();
    }
  };
  warm();
  draw();

  const tick = (ts: number) => {
    if (!alive) return;
    raf = requestAnimationFrame(tick);
    if (ts - lastFrame < FRAME_MS) return;
    const dt = lastFrame === 0 ? FRAME_MS : Math.min(ts - lastFrame, 100);
    lastFrame = ts;
    now += dt;
    step();
    draw();
  };

  const running = () => raf !== 0;
  const start = () => {
    if (running() || m.reduced || document.visibilityState === 'hidden') return;
    lastFrame = 0;
    raf = requestAnimationFrame(tick);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const onScroll = () => {
    if (!running()) draw();
  };
  const onResize = () => {
    m = measure(box);
    size();
    draw();
  };
  const onVis = () => (document.visibilityState === 'hidden' ? stop() : start());
  const csQ = window.matchMedia('(prefers-color-scheme: dark)');
  const moQ = window.matchMedia('(prefers-reduced-motion: reduce)');
  const recolor = () => {
    pal = readPalette();
    draw();
  };
  const remotion = () => {
    m = { ...m, reduced: moQ.matches };
    if (m.reduced) stop();
    else start();
    draw();
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVis);
  csQ.addEventListener('change', recolor);
  moQ.addEventListener('change', remotion);
  const ro = new ResizeObserver(onResize);
  ro.observe(box);
  document.fonts?.ready.then(onResize).catch(() => {});
  start();

  return () => {
    alive = false;
    stop();
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVis);
    csQ.removeEventListener('change', recolor);
    moQ.removeEventListener('change', remotion);
    ro.disconnect();
  };
}
