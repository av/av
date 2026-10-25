import { cssVar, h, prefersReduced, s, watchVisible } from './util';

// Fig. 2: every decision at the keyboard streams to the tool vendor and the
// employer. The switch adds the third pipe, into your own harness; while it
// is off, that sink stays at zero.

type Kind = 'accept' | 'reject' | 'edit' | 'revert' | 'stop';
type Sink = 'vendor' | 'employer' | 'harness';
type Particle = { el: SVGRectElement; route: Float32Array; t0: number; sink: Sink; kind: Kind };

const KINDS: [Kind, number][] = [['accept', 0.34], ['reject', 0.22], ['edit', 0.2], ['revert', 0.14], ['stop', 0.1]];
const TRAVEL_MS = 1700;
const EMIT_MS = 300;
const SAMPLES = 120;

function pickKind(r: number): Kind {
  let acc = 0;
  for (const [k, p] of KINDS) {
    acc += p;
    if (r < acc) return k;
  }
  return 'accept';
}

export function initFlowFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxf');
  const svg = s('svg', { class: 'fxf-svg', 'aria-hidden': 'true' });
  const paths: Record<Sink, SVGPathElement> = {
    vendor: s('path', { class: 'fxf-pipe' }),
    employer: s('path', { class: 'fxf-pipe' }),
    harness: s('path', { class: 'fxf-pipe is-harness' }),
  };
  Object.values(paths).forEach((p) => svg.append(p));
  const dots = s('g');
  svg.append(dots);

  const node = (cls: string, title: string, sub: string, count: string) => {
    const el = h('div', `fxf-node ${cls}`);
    el.append(h('div', 'fxf-node__title', title), h('div', 'fxf-node__sub', sub));
    const c = h('div', 'fxf-node__count');
    c.innerHTML = count;
    el.append(c);
    return el;
  };

  const you = h('div', 'fxf-node fxf-you');
  you.append(h('div', 'fxf-node__title', 'you'), h('div', 'fxf-node__sub', 'at the keyboard'));
  const burst = h('div', 'fxf-burst');
  you.append(burst);

  const vendor = node('fxf-sink is-vendor', 'tool vendor', 'reward model', '<b>0</b> gradient steps');
  const employer = node('fxf-sink is-employer', 'employer', 'telemetry collector', '<b>0</b> trajectories');
  const harness = node('fxf-sink is-harness', 'your harness', 'rules · tests · scripts', '<b>0</b> rules');
  employer.querySelector('.fxf-node__title')!.insertAdjacentHTML(
    'beforeend',
    '<svg class="fxf-lock" viewBox="0 0 12 14"><path d="M3 7 V4.5 a3 3 0 0 1 6 0 V7" /><rect x="1.5" y="6.5" width="9" height="7" rx="1.2" /></svg>',
  );

  const toggle = h('button', 'fxf-toggle');
  toggle.type = 'button';
  toggle.setAttribute('role', 'switch');
  toggle.innerHTML = '<span class="fxf-toggle__track"><i></i></span><span class="fxf-toggle__label">local trace capture</span><b class="fxf-toggle__state">off</b>';

  stage.append(svg, you, vendor, employer, harness, toggle);
  fig.prepend(stage);

  const counts: Record<Sink, number> = { vendor: 0, employer: 0, harness: 0 };
  let corrections = 0;
  let local = false;
  let touched = false;
  let visible = false;
  let raf = 0;
  let lastEmit = 0;
  let emitted = 0;
  let particles: Particle[] = [];
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  let colors = { red: '', green: '', tx: '' };
  // Each pipe sampled once per layout, so particles never query the path.
  const routes = {} as Record<Sink, Float32Array>;

  const setCount = (sink: Sink) => {
    const el = { vendor, employer, harness }[sink].querySelector('b')!;
    el.textContent = counts[sink].toLocaleString('en-US');
  };

  const setLocal = (on: boolean) => {
    local = on;
    stage.classList.toggle('is-local', on);
    toggle.setAttribute('aria-checked', String(on));
    toggle.querySelector('.fxf-toggle__state')!.textContent = on ? 'on' : 'off';
  };
  setLocal(false);

  toggle.addEventListener('click', () => {
    touched = true;
    setLocal(!local);
  });

  const layout = () => {
    const W = stage.clientWidth;
    const narrow = W < 560;
    const H = narrow ? 420 : 340;
    stage.style.height = `${H}px`;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', String(W));
    svg.setAttribute('height', String(H));
    const youW = narrow ? 78 : 104;
    const sinkW = narrow ? Math.min(170, W * 0.52) : 220;
    const sinkH = narrow ? 74 : 72;
    const yMid = H / 2 - 18;
    const ys = [H * 0.17, yMid, H * 0.83 - 36];
    you.style.cssText = `left:${narrow ? 10 : 18}px; top:${yMid - 32}px; width:${youW}px;`;
    const sx = W - sinkW - (narrow ? 10 : 18);
    [vendor, employer, harness].forEach((el, i) => {
      el.style.cssText = `left:${sx}px; top:${ys[i] - sinkH / 2}px; width:${sinkW}px; min-height:${sinkH}px;`;
    });
    const x0 = (narrow ? 10 : 18) + youW;
    (['vendor', 'employer', 'harness'] as Sink[]).forEach((k, i) => {
      const y1 = ys[i];
      const mx = (x0 + sx) / 2;
      paths[k].setAttribute('d', `M ${x0} ${yMid} C ${mx} ${yMid}, ${mx} ${y1}, ${sx} ${y1}`);
      const len = paths[k].getTotalLength();
      const pts = new Float32Array((SAMPLES + 1) * 2);
      for (let i = 0; i <= SAMPLES; i++) {
        const pt = paths[k].getPointAtLength((len * i) / SAMPLES);
        pts[i * 2] = pt.x;
        pts[i * 2 + 1] = pt.y;
      }
      routes[k] = pts;
    });
  };

  const emit = (now: number) => {
    const kind = pickKind(rand());
    emitted++;
    const sinks: Sink[] = local ? ['vendor', 'employer', 'harness'] : ['vendor', 'employer'];
    const color = kind === 'accept' ? colors.tx : kind === 'edit' ? colors.green : colors.red;
    sinks.forEach((sink, i) => {
      const el = s('rect', { width: 6, height: 6, x: -3, y: -3, fill: color, opacity: 0 });
      dots.append(el);
      particles.push({ el, route: routes[sink], t0: now + i * 40, sink, kind });
    });
    if (emitted % 3 === 0) {
      const tag = h('span', `fxf-tag is-${kind}`, kind);
      burst.append(tag);
      setTimeout(() => tag.remove(), 1400);
    }
  };

  const arrive = (p: Particle) => {
    if (p.sink !== 'harness') {
      counts[p.sink]++;
    } else if (p.kind !== 'accept') {
      corrections++;
      if (corrections % 4 === 0) {
        counts.harness++;
        harness.classList.remove('is-ping');
        void harness.offsetWidth;
        harness.classList.add('is-ping');
      }
    }
    setCount(p.sink);
  };

  let lastFrame = 0;
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (now - lastFrame < 32) return;
    lastFrame = now;
    if (now - lastEmit > EMIT_MS) {
      lastEmit = now;
      emit(now);
    }
    particles = particles.filter((p) => {
      const k = (now - p.t0) / TRAVEL_MS;
      if (k < 0) return true;
      if (k >= 1) {
        arrive(p);
        p.el.remove();
        return false;
      }
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const i = Math.round(e * SAMPLES) * 2;
      p.el.setAttribute('transform', `translate(${p.route[i].toFixed(1)} ${p.route[i + 1].toFixed(1)})`);
      p.el.setAttribute('opacity', String(Math.min(1, k * 6, (1 - k) * 8)));
      return true;
    });
  };

  const start = () => {
    if (raf || prefersReduced()) return;
    colors = { red: cssVar('red'), green: cssVar('green'), tx: cssVar('tx3') };
    raf = requestAnimationFrame(tick);
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
  };

  layout();
  new ResizeObserver(() => layout()).observe(stage);

  if (prefersReduced()) {
    counts.vendor = 1240;
    counts.employer = 1240;
    counts.harness = 0;
    (['vendor', 'employer', 'harness'] as Sink[]).forEach(setCount);
    return;
  }

  let autoTimer = 0;
  watchVisible(
    stage,
    (on) => {
      visible = on;
      if (on) {
        start();
        if (!touched && !local && !autoTimer) {
          autoTimer = window.setTimeout(() => {
            if (!touched && visible) setLocal(true);
          }, 6500);
        }
      } else {
        stop();
        clearTimeout(autoTimer);
        autoTimer = 0;
      }
    },
    0.3,
  );
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : visible && start()));
}
