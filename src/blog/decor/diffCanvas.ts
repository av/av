import { createSeededRandom } from './seededRandom';

// A code minimap behind the post header that is always being edited: rows of
// grey token blocks where hunks keep turning red, shrinking away, and coming
// back green. It covers the header only and pauses once scrolled out of view.

type Metrics = {
  width: number;
  height: number;
  dpr: number;
  reduced: boolean;
  pitch: number;
  block: number;
  laneW: number;
  lanes: number[];
};

type Hunk = { lane: number; row: number; len: number; t0: number };
type Palette = { tx: string; red: string; green: string };

const DEL_MS = 1500;
const ADD_MS = 900;
const SETTLE_MS = 3200;
const HUNK_MS = DEL_MS + ADD_MS + SETTLE_MS;
const FRAME_MS = 1000 / 30;
const FADE_PX = 90;
const NEUTRAL_ALPHA = 0.2;

function hash(a: number, b: number, c: number): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

// Token widths for one line of fake code, starting with the line's indent.
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
  const rect = box.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const mobile = width < 768;
  const content = box.querySelector('.blog-content');
  const height = content ? Math.round(content.getBoundingClientRect().top - rect.top) : 320;
  const laneW = mobile ? 150 : 210;
  const lanes: number[] = [];
  for (let x = mobile ? 10 : 18; x < width; x += laneW + (mobile ? 18 : 30)) lanes.push(x);
  return {
    width,
    height: Math.max(1, height),
    dpr: Math.min(mobile ? 1.5 : 2, window.devicePixelRatio || 1),
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    pitch: mobile ? 9 : 11,
    block: mobile ? 3 : 4,
    laneW,
    lanes,
  };
}

export function initDiffCanvas(canvas: HTMLCanvasElement, seed: string): () => void {
  const box = canvas.parentElement;
  const ctx = canvas.getContext('2d');
  if (!box || !ctx) return () => {};

  const base = Math.floor(createSeededRandom(`${seed}:diff`)() * 2 ** 31);
  const rand = createSeededRandom(`${seed}:hunks`);
  const versions = new Map<string, number>();
  let hunks: Hunk[] = [];
  let m = measure(box);
  let pal = readPalette();
  let now = 0;
  let raf = 0;
  let lastFrame = 0;
  let visible = true;

  const size = () => {
    canvas.width = Math.round(m.width * m.dpr);
    canvas.height = Math.round(m.height * m.dpr);
    canvas.style.width = `${m.width}px`;
    canvas.style.height = `${m.height}px`;
    canvas.style.bottom = 'auto';
  };
  size();

  const rows = () => Math.ceil(m.height / m.pitch);

  const spawn = () => {
    const lane = Math.floor(rand() * m.lanes.length);
    const len = 1 + Math.floor(rand() * 4);
    const row = Math.floor(rand() * Math.max(1, rows() - len - 4));
    if (hunks.some((h) => h.lane === lane && row < h.row + h.len + 2 && h.row < row + len + 2)) return;
    hunks.push({ lane, row, len, t0: now });
  };

  const hunkAt = (lane: number, row: number) =>
    hunks.find((h) => h.lane === lane && row >= h.row && row < h.row + h.len);

  const draw = () => {
    ctx.setTransform(m.dpr, 0, 0, m.dpr, 0, 0);
    ctx.clearRect(0, 0, m.width, m.height);
    const last = rows();
    for (let li = 0; li < m.lanes.length; li++) {
      const lx = m.lanes[li];
      for (let row = 0; row <= last; row++) {
        const y = row * m.pitch;
        const version = versions.get(`${li}:${row}`) ?? 0;
        const h = hunkAt(li, row);
        let tokens = lineTokens(base, li, row, version, m.laneW);
        let color = pal.tx;
        let alpha = NEUTRAL_ALPHA;
        let reveal = 1;
        let band: string | null = null;
        let bandA = 0;

        if (h) {
          const t = now - h.t0;
          const stagger = (row - h.row) * 90;
          if (t < DEL_MS) {
            const k = Math.min(1, Math.max(0, (t - stagger) / 420));
            color = pal.red;
            alpha = NEUTRAL_ALPHA + (0.62 - NEUTRAL_ALPHA) * k;
            reveal = 1 - Math.min(1, Math.max(0, (t - 600 - stagger) / 600));
            band = pal.red;
            bandA = 0.1 * k;
          } else {
            tokens = lineTokens(base, li, row, version + 1, m.laneW);
            const ta = t - DEL_MS;
            reveal = Math.min(1, Math.max(0, (ta - stagger) / (ADD_MS - 300)));
            const settle = Math.min(1, Math.max(0, (ta - ADD_MS) / SETTLE_MS));
            color = settle < 1 ? pal.green : pal.tx;
            alpha = 0.66 - (0.66 - NEUTRAL_ALPHA) * settle;
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
          ctx.fillRect(x, y, Math.min(tokens[i], budget), m.block);
          budget -= tokens[i] + 4;
          x += tokens[i] + 4;
        }
      }
    }

    // Fade the field out above the first paragraph.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;
    const g = ctx.createLinearGradient(0, m.height - FADE_PX, 0, m.height);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, m.height - FADE_PX, m.width, FADE_PX);
    ctx.globalCompositeOperation = 'source-over';
  };

  const step = () => {
    for (const h of hunks) {
      if (now - h.t0 < HUNK_MS) continue;
      for (let r = h.row; r < h.row + h.len; r++) {
        const key = `${h.lane}:${r}`;
        versions.set(key, (versions.get(key) ?? 0) + 1);
      }
    }
    hunks = hunks.filter((h) => now - h.t0 < HUNK_MS);
    const target = Math.max(2, Math.round(m.lanes.length * 1.2));
    if (hunks.length < target && rand() < 0.08) spawn();
  };

  // Start mid-edit so the first paint, and the reduced-motion still, already
  // show hunks at different stages.
  for (let i = 0; i < 400; i++) {
    now += 50;
    step();
  }
  draw();

  const tick = (ts: number) => {
    raf = requestAnimationFrame(tick);
    if (ts - lastFrame < FRAME_MS) return;
    now += lastFrame === 0 ? FRAME_MS : Math.min(ts - lastFrame, 100);
    lastFrame = ts;
    step();
    draw();
  };

  const start = () => {
    if (raf || m.reduced || !visible || document.visibilityState === 'hidden') return;
    lastFrame = 0;
    raf = requestAnimationFrame(tick);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  const refit = () => {
    const next = measure(box);
    if (next.width === m.width && next.height === m.height && next.dpr === m.dpr) return;
    m = next;
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
  };

  const io = new IntersectionObserver((es) => {
    visible = es.some((e) => e.isIntersecting);
    if (visible) start();
    else stop();
  });
  io.observe(canvas);
  window.addEventListener('resize', refit);
  document.addEventListener('visibilitychange', onVis);
  csQ.addEventListener('change', recolor);
  moQ.addEventListener('change', remotion);
  document.fonts?.ready.then(refit).catch(() => {});
  start();

  return () => {
    stop();
    io.disconnect();
    window.removeEventListener('resize', refit);
    document.removeEventListener('visibilitychange', onVis);
    csQ.removeEventListener('change', recolor);
    moQ.removeEventListener('change', remotion);
  };
}
