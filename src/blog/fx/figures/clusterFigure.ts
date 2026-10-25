import { createRandom, cssVar, h, prefersReduced, scrollProgress, watchVisible } from './util';

// Fig. 3: a thousand simulated interventions. Scrolling pulls ninety percent
// of them into fifteen clusters, one per veto; the rest stay loose and turn
// green, the small part of judgment that does not compile.

const RULES = [
  'retry on 4xx',
  'drive-by config',
  'test bent to pass',
  'wrong config path',
  'env before code',
  'migration heads',
  'sleep-polling CI',
  'unread full diff',
  'lockfile churn',
  'silent catch',
  'scope creep',
  'secrets in logs',
  'unpinned deps',
  'no rollback',
  'dead code left',
];

const N = 1000;
const RARE = 0.1;

type Pt = { sx: number; sy: number; tx: number; ty: number; c: number; delay: number; ph: number };

function gauss(r: () => number): number {
  return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
}

export function initClusterFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxk');
  const canvas = h('canvas', 'fxk-canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const hud = h('div', 'fxk-hud');
  const hudMain = h('div', 'fxk-hud__main');
  const hudSub = h('div', 'fxk-hud__sub');
  hud.append(hudMain, hudSub);
  const note = h('div', 'fxk-note', 'simulated · illustration');
  stage.append(canvas, hud, note);
  fig.prepend(stage);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let W = 0;
  let H = 0;
  let narrow = false;
  let pts: Pt[] = [];
  let centers: { x: number; y: number; n: number; r: number }[] = [];
  let colors = { tx: '', tx2: '', green: '', bg: '' };
  let shown = 0;
  let raf = 0;
  let visible = false;

  const build = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = stage.clientWidth;
    narrow = W < 560;
    H = narrow ? Math.round(W * 1.15) : Math.round(Math.min(480, W * 0.62));
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const r = createRandom(20261025);
    const cols = narrow ? 3 : 5;
    const rows = Math.ceil(RULES.length / cols);
    const top = narrow ? 64 : 58;
    const cw = (W - 24) / cols;
    const ch = (H - top - 26) / rows;
    const weights = RULES.map((_, i) => 1 / Math.pow(i + 1, 0.75));
    const wsum = weights.reduce((a, b) => a + b, 0);
    const clustered = Math.round(N * (1 - RARE));
    // Bigger clusters sit near the middle of the grid.
    const cells = Array.from({ length: cols * rows }, (_, i) => i)
      .map((i) => ({ i, d: Math.hypot((i % cols) - (cols - 1) / 2, Math.floor(i / cols) - (rows - 1) / 2) + r() * 0.3 }))
      .sort((a, b) => a.d - b.d);
    centers = RULES.map((_, k) => {
      const cell = cells[k].i;
      return {
        x: 12 + cw * ((cell % cols) + 0.5) + (r() - 0.5) * cw * 0.12,
        y: top + ch * (Math.floor(cell / cols) + 0.42) + (r() - 0.5) * ch * 0.1,
        n: Math.round((weights[k] / wsum) * clustered),
        r: 0,
      };
    });

    pts = [];
    const pad = 10;
    const spread = Math.min(cw, ch) * (narrow ? 0.15 : 0.13);
    centers.forEach((c, k) => {
      const rad = spread * (0.5 + Math.sqrt(c.n) / 12);
      c.r = rad;
      for (let i = 0; i < c.n; i++) {
        pts.push({
          sx: pad + r() * (W - pad * 2),
          sy: top - 20 + r() * (H - top),
          tx: c.x + gauss(r) * rad,
          ty: c.y + gauss(r) * rad * 0.75,
          c: k,
          delay: r() * 0.35,
          ph: r() * Math.PI * 2,
        });
      }
    });
    while (pts.length < N) {
      const x = pad + r() * (W - pad * 2);
      const y = top - 20 + r() * (H - top);
      pts.push({ sx: x, sy: y, tx: x, ty: y, c: -1, delay: r() * 0.35, ph: r() * Math.PI * 2 });
    }
    colors = { tx: cssVar('tx'), tx2: cssVar('tx2'), green: cssVar('green'), bg: cssVar('bg2') };
  };

  const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

  const draw = (t: number) => {
    ctx.clearRect(0, 0, W, H);
    const p = shown;
    const size = narrow ? 2 : 2.4;
    const wob = prefersReduced() ? 0 : 1;
    for (const q of pts) {
      const k = ease(Math.min(1, Math.max(0, (p - q.delay) / 0.6)));
      const jx = Math.sin(t * 0.0013 + q.ph) * 1.6 * wob * (1 - k * 0.8);
      const jy = Math.cos(t * 0.0011 + q.ph * 1.3) * 1.6 * wob * (1 - k * 0.8);
      const x = q.sx + (q.tx - q.sx) * k + jx;
      const y = q.sy + (q.ty - q.sy) * k + jy;
      if (q.c < 0) {
        const g = Math.min(1, Math.max(0, (p - 0.7) / 0.25));
        ctx.globalAlpha = 0.55 + 0.45 * g;
        ctx.fillStyle = g > 0.5 ? colors.green : colors.tx2;
        const sz = size + g * 1.4;
        ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      } else {
        ctx.globalAlpha = 0.5 + 0.25 * k;
        ctx.fillStyle = k > 0.95 ? colors.tx : colors.tx2;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }
    const la = Math.min(1, Math.max(0, (p - 0.72) / 0.2));
    if (la > 0) {
      ctx.globalAlpha = la;
      ctx.fillStyle = colors.tx;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = `500 ${narrow ? 10 : 11}px 'Geist Pixel', ui-monospace, monospace`;
      centers.forEach((c, k) => {
        ctx.fillText(RULES[k], c.x, c.y + c.r * 0.75 * 2.7 + 6);
      });
    }
    ctx.globalAlpha = 1;

    if (p < 0.2) {
      hudMain.textContent = `${N.toLocaleString('en-US')} interventions`;
      hudSub.textContent = 'every reject, edit, revert and stop, unsorted';
    } else if (p < 0.85) {
      hudMain.textContent = 'clustering…';
      hudSub.textContent = `${Math.round(((p - 0.2) / 0.65) * 90)}% explained`;
    } else {
      hudMain.innerHTML = '15 vetoes cover 90%';
      hudSub.innerHTML = '<span class="fxk-green">■</span> the loose 10% is the judgment that does not compile';
    }
  };

  const tick = (t: number) => {
    raf = requestAnimationFrame(tick);
    const target = scrollProgress(stage, 0.95, 0.15);
    shown += (target - shown) * 0.08;
    if (Math.abs(target - shown) < 0.0005) shown = target;
    draw(t);
  };

  build();
  new ResizeObserver(() => {
    if (Math.abs(stage.clientWidth - W) > 1) {
      build();
      draw(performance.now());
    }
  }).observe(stage);

  if (prefersReduced()) {
    shown = 1;
    draw(0);
    return;
  }

  shown = scrollProgress(stage, 0.95, 0.15);
  draw(0);
  watchVisible(
    stage,
    (on) => {
      visible = on;
      if (on && !raf) raf = requestAnimationFrame(tick);
      if (!on) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    0,
  );
  document.fonts?.ready.then(() => draw(performance.now())).catch(() => {});
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (visible && !raf) {
      raf = requestAnimationFrame(tick);
    }
  });
}
