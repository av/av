import { createRandom, cssVar, h, prefersReduced, scrollProgress, watchVisible } from './util';

// Fig. 11 (clusters): 1,000 interventions collapsing into 15 gravity wells on scroll,
// leaving 10% glowing green stars free.
const CLUSTER_COUNT = 15;
const N = 1000;
const RARE = 0.1;

type Pt = { sx: number; sy: number; tx: number; ty: number; c: number; delay: number };

function gauss(r: () => number): number {
  return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
}

export function initClusterFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxk');
  const canvas = h('canvas', 'fxk-canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const hud = h('div', 'fxk-hud');
  const hudMain = h('div', 'fxk-hud__main');
  hud.append(hudMain);
  stage.append(canvas, hud);
  fig.prepend(stage);

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let W = 0;
  let H = 0;
  let narrow = false;
  let pts: Pt[] = [];
  let centers: { x: number; y: number; n: number; r: number }[] = [];
  let colors = { tx: '', tx2: '', tx3: '', green: '', bg: '' };
  let shown = 0;
  let raf = 0;
  let visible = false;

  const build = () => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = stage.clientWidth || 680;
    narrow = W < 560;
    H = narrow ? 250 : 280;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const r = createRandom(20261025);
    const cols = narrow ? 3 : 5;
    const rows = Math.ceil(CLUSTER_COUNT / cols);
    const top = 42;
    const cw = (W - 24) / cols;
    const ch = (H - top - 16) / rows;
    const weights = Array.from({ length: CLUSTER_COUNT }, (_, i) => 1 / Math.pow(i + 1, 0.75));
    const wsum = weights.reduce((a, b) => a + b, 0);
    const clustered = Math.round(N * (1 - RARE));

    const cells = Array.from({ length: cols * rows }, (_, i) => i)
      .map((i) => ({ i, d: Math.hypot((i % cols) - (cols - 1) / 2, Math.floor(i / cols) - (rows - 1) / 2) + r() * 0.3 }))
      .sort((a, b) => a.d - b.d);

    centers = weights.map((w, k) => {
      const cell = cells[k].i;
      return {
        x: 12 + cw * ((cell % cols) + 0.5) + (r() - 0.5) * cw * 0.12,
        y: top + ch * (Math.floor(cell / cols) + 0.5) + (r() - 0.5) * ch * 0.1,
        n: Math.round((w / wsum) * clustered),
        r: 0,
      };
    });

    pts = [];
    const pad = 12;
    const spread = Math.min(cw, ch) * 0.15;
    centers.forEach((c, k) => {
      const rad = spread * (0.5 + Math.sqrt(c.n) / 12);
      c.r = rad;
      for (let i = 0; i < c.n; i++) {
        pts.push({
          sx: pad + r() * (W - pad * 2),
          sy: top - 10 + r() * (H - top),
          tx: c.x + gauss(r) * rad,
          ty: c.y + gauss(r) * rad * 0.8,
          c: k,
          delay: r() * 0.35,
        });
      }
    });
    while (pts.length < N) {
      const x = pad + r() * (W - pad * 2);
      const y = top - 10 + r() * (H - top);
      pts.push({ sx: x, sy: y, tx: x, ty: y, c: -1, delay: r() * 0.35 });
    }
    colors = { tx: cssVar('tx'), tx2: cssVar('tx2'), tx3: cssVar('tx3'), green: cssVar('green'), bg: cssVar('bg2') };
  };

  const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

  let hudKey = '';
  const setHud = (main: string) => {
    if (main === hudKey) return;
    hudKey = main;
    hudMain.innerHTML = main;
  };

  const draw = () => {
    ctx.clearRect(0, 0, W, H);
    const p = shown;
    const size = narrow ? 2 : 2.4;

    // Subtle gravity rings around the 15 wells as they lock in
    const la = Math.min(1, Math.max(0, (p - 0.65) / 0.25));
    if (la > 0) {
      ctx.strokeStyle = colors.tx3;
      ctx.globalAlpha = la * 0.35;
      ctx.lineWidth = 1;
      centers.forEach((c) => {
        ctx.beginPath();
        ctx.arc(c.x, c.y, c.r * 2.1, 0, Math.PI * 2);
        ctx.stroke();
      });
    }

    for (const q of pts) {
      const k = ease(Math.min(1, Math.max(0, (p - q.delay) / 0.6)));
      const x = q.sx + (q.tx - q.sx) * k;
      const y = q.sy + (q.ty - q.sy) * k;
      if (q.c < 0) {
        const g = Math.min(1, Math.max(0, (p - 0.65) / 0.25));
        ctx.globalAlpha = 0.55 + 0.45 * g;
        ctx.fillStyle = g > 0.4 ? colors.green : colors.tx2;
        const sz = size + g * 1.6;
        ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      } else {
        ctx.globalAlpha = 0.45 + 0.3 * k;
        ctx.fillStyle = k > 0.95 ? colors.tx : colors.tx2;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;

    setHud('90% · 15 rules &nbsp;&nbsp;<span class="fxk-green">■ 10% · rare</span>');
  };

  let drawn = -1;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    const target = scrollProgress(stage, 0.95, 0.15);
    shown += (target - shown) * 0.12;
    if (Math.abs(target - shown) < 0.001) shown = target;
    if (shown === drawn) return;
    drawn = shown;
    draw();
  };

  build();
  new ResizeObserver(() => {
    if (Math.abs(stage.clientWidth - W) > 1) {
      build();
      draw();
    }
  }).observe(stage);

  if (prefersReduced()) {
    shown = 1;
    draw();
    return;
  }

  shown = scrollProgress(stage, 0.95, 0.15);
  draw();
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
}
