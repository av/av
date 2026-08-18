import { createSeededRandom } from './seededRandom';

type Boid = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  group: number;
  lead: boolean;
  phase: number;
  trail: number[];
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

const STEP_MS = 16;
const SPEED = 0.55;
const MAX_FORCE = 0.03;
const NEIGHBOUR = 70;
const SEPARATION = 26;
const LEAD_PULL = 0.0022;
const TRAIL = 8;
const TRAIL_MS = 80;
const WANDER = 0.00022;
const GROUPS = 3;

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
  const zoneTop = Math.max(6, tBot - 150);
  // On mobile there are no side margins, so the swarms stay above the text.
  const zoneBot = tBot + (mobile ? 90 : 300);
  return { width: w, height: h, dpr, mobile, reduced, zoneTop, zoneBot, drawH: Math.min(zoneBot + 30, h) };
}

/** Slow drifting target each swarm's leader chases, spread across the band. */
function leadTarget(g: number, phase: number, t: number, m: Metrics): [number, number] {
  const lane = (g + 0.5) / GROUPS;
  const midY = (m.zoneTop + m.zoneBot) * 0.5;
  const spanY = (m.zoneBot - m.zoneTop) * 0.34;
  const x = m.width * lane + Math.sin(t * WANDER + phase) * m.width * 0.2;
  const y = midY + Math.sin(t * WANDER * 1.7 + phase * 2) * spanY;
  return [x, y];
}

function buildFlock(rand: () => number, m: Metrics, n: number): Boid[] {
  const perGroup = Math.ceil(n / GROUPS);

  return Array.from({ length: n }, (_, i) => {
    const group = Math.floor(i / perGroup);
    const lane = (group + 0.5) / GROUPS;
    const angle = rand() * Math.PI * 2;
    return {
      x: m.width * lane + (rand() - 0.5) * m.width * 0.22,
      y: m.zoneTop + (0.25 + rand() * 0.5) * (m.zoneBot - m.zoneTop),
      vx: Math.cos(angle) * SPEED,
      vy: Math.sin(angle) * SPEED * 0.5,
      group,
      // One supervisor per swarm; the rest steer toward it.
      lead: i % perGroup === 0,
      phase: rand() * Math.PI * 2,
      trail: [],
    };
  });
}

function limit(x: number, y: number, max: number): [number, number] {
  const len = Math.hypot(x, y);
  if (len <= max || len === 0) return [x, y];
  return [(x / len) * max, (y / len) * max];
}

function stepFlock(flock: Boid[], m: Metrics, t: number): void {
  const leads = flock.filter(b => b.lead);

  for (const b of flock) {
    let ax = 0;
    let ay = 0;

    if (b.lead) {
      const [tx, ty] = leadTarget(b.group, b.phase, t, m);
      ax += (tx - b.x) * 0.0009;
      ay += (ty - b.y) * 0.0014;
    } else {
      let sepX = 0, sepY = 0;
      let aliX = 0, aliY = 0;
      let cohX = 0, cohY = 0;
      let n = 0;

      for (const o of flock) {
        if (o === b) continue;
        const dx = o.x - b.x;
        const dy = o.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 === 0) continue;

        if (d2 < SEPARATION * SEPARATION) {
          sepX -= dx / d2;
          sepY -= dy / d2;
        }

        if (o.group !== b.group || d2 > NEIGHBOUR * NEIGHBOUR) continue;

        n++;
        aliX += o.vx;
        aliY += o.vy;
        cohX += o.x;
        cohY += o.y;
      }

      ax += sepX * 6;
      ay += sepY * 6;

      if (n > 0) {
        ax += (aliX / n - b.vx) * 0.03 + (cohX / n - b.x) * 0.0004;
        ay += (aliY / n - b.vy) * 0.03 + (cohY / n - b.y) * 0.0004;
      }

      const lead = leads.find(l => l.group === b.group);
      if (lead) {
        ax += (lead.x - b.x) * LEAD_PULL;
        ay += (lead.y - b.y) * LEAD_PULL;
      }
    }

    // Soft walls keep the flock inside the header band.
    if (b.y < m.zoneTop + 20) ay += (m.zoneTop + 20 - b.y) * 0.005;
    if (b.y > m.zoneBot - 20) ay -= (b.y - (m.zoneBot - 20)) * 0.005;

    [ax, ay] = limit(ax, ay, MAX_FORCE);
    b.vx += ax;
    b.vy += ay;

    const target = b.lead ? SPEED * 0.9 : SPEED;
    const sp = Math.hypot(b.vx, b.vy) || 1;
    b.vx = (b.vx / sp) * target;
    b.vy = (b.vy / sp) * target;

    b.x += b.vx;
    b.y += b.vy;

    if (b.x < -20) b.x += m.width + 40;
    if (b.x > m.width + 20) b.x -= m.width + 40;
  }
}

function pushTrail(flock: Boid[]): void {
  for (const b of flock) {
    b.trail.unshift(b.x, b.y);
    if (b.trail.length > TRAIL * 2) b.trail.length = TRAIL * 2;
  }
}

export function initBoidsCanvas(
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
  let flock = buildFlock(createSeededRandom(`${seed}:flock`), m, m.mobile ? 36 : 60);
  let t = 0;

  let raf = 0;
  let last: number | null = null;
  let stepAccum = 0;
  let trailAccum = 0;
  let vis = true;
  let alive = true;
  let looping = false;

  const trailEvery = Math.round(TRAIL_MS / STEP_MS);

  const warm = (steps: number) => {
    for (let i = 0; i < steps; i++) {
      t += STEP_MS;
      stepFlock(flock, m, t);
      if (i % trailEvery === 0) pushTrail(flock);
    }
  };
  warm(320);

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
    ctx.fillStyle = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const fadeStart = m.zoneTop + (m.zoneBot - m.zoneTop) * 0.62;
    const fadeRange = m.zoneBot - fadeStart;

    for (const b of flock) {
      const vFade = b.y > fadeStart ? Math.max(0, 1 - (b.y - fadeStart) / fadeRange) : 1;
      const topFade = b.y < m.zoneTop + 50 ? Math.max(0, (b.y - m.zoneTop) / 50) : 1;
      const base = (b.lead ? 0.55 : 0.34) * vFade * topFade;
      if (base <= 0.01) continue;

      ctx.lineWidth = b.lead ? 1.4 : 1;
      for (let i = 2; i < b.trail.length - 1; i += 2) {
        const x1 = b.trail[i - 2];
        const y1 = b.trail[i - 1];
        const x2 = b.trail[i];
        const y2 = b.trail[i + 1];
        if (Math.abs(x2 - x1) > m.width * 0.5) continue;
        ctx.globalAlpha = base * (1 - i / b.trail.length) * 0.55;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }

      // Body — a small arrowhead pointing along the velocity.
      const a = Math.atan2(b.vy, b.vx);
      const size = b.lead ? 6 : 4;
      ctx.globalAlpha = base;
      ctx.beginPath();
      ctx.moveTo(b.x + Math.cos(a) * size, b.y + Math.sin(a) * size);
      ctx.lineTo(b.x + Math.cos(a + 2.5) * size * 0.8, b.y + Math.sin(a + 2.5) * size * 0.8);
      ctx.lineTo(b.x + Math.cos(a - 2.5) * size * 0.8, b.y + Math.sin(a - 2.5) * size * 0.8);
      ctx.closePath();
      ctx.fill();
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
    trailAccum += dt;

    while (stepAccum >= STEP_MS) {
      stepAccum -= STEP_MS;
      t += STEP_MS;
      stepFlock(flock, m, t);
    }

    while (trailAccum >= TRAIL_MS) {
      trailAccum -= TRAIL_MS;
      pushTrail(flock);
    }

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
      flock = buildFlock(createSeededRandom(`${seed}:flock`), m, m.mobile ? 36 : 60);
      t = 0;
      stepAccum = 0;
      trailAccum = 0;
      warm(320);
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
