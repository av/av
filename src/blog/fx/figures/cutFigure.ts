import { cssVar, h, prefersReduced, s, watchVisible } from './util';

// Fig. 1: Trajectory Divergence (Agent branch vs Your cut).
// Plots the agent's 6-step autonomous rollout (climbing in green) against
// the human's 5 interventions right before merge, showing how the 6-word
// prompt is noise while the correction delta is the training pair.

type EventSpec = {
  id: string;
  x: number;
  ay: number;
  hy: number;
  kind: 'reject' | 'edit' | 'revert' | 'stop';
  tag: string;
  file: string;
  agent: string;
  human: string;
  why: string;
};

const EVENTS: EventSpec[] = [
  {
    id: 'e1',
    x: 0.2,
    ay: 0.28,
    hy: 0.62,
    kind: 'reject',
    tag: '✕ reject',
    file: 'src/upload_client.py:42',
    agent: '+ if r.status_code >= 400: continue',
    human: '+ if r.status_code >= 500: continue',
    why: 'Retrying HTTP 400 hammers your own auth service on a bad payload.',
  },
  {
    id: 'e2',
    x: 0.38,
    ay: 0.22,
    hy: 0.66,
    kind: 'edit',
    tag: '✎ edit',
    file: 'src/upload_client.py:44',
    agent: '+ time.sleep(2 ** attempt)',
    human: '+ time.sleep(jitter_backoff(attempt, cap=8.0))',
    why: 'Synchronized exponential sleeps thundering-herd the upstream after a blip.',
  },
  {
    id: 'e3',
    x: 0.56,
    ay: 0.18,
    hy: 0.72,
    kind: 'revert',
    tag: '↺ revert',
    file: 'config/prod.yaml:18',
    agent: '- timeout: 30   + timeout: 300',
    human: 'git checkout -- config/prod.yaml',
    why: 'Leftover debugging guess from an abandoned attempt still sitting in the tree.',
  },
  {
    id: 'e4',
    x: 0.74,
    ay: 0.15,
    hy: 0.76,
    kind: 'revert',
    tag: '↺ revert',
    file: 'tests/test_upload.py:89',
    agent: '- assert r.status_code == 422   + assert r.status_code in (200, 422)',
    human: 'restore assert r.status_code == 422',
    why: 'The model loosened the assertion to make a broken run turn green.',
  },
  {
    id: 'e5',
    x: 0.9,
    ay: 0.12,
    hy: 0.8,
    kind: 'stop',
    tag: '■ abort',
    file: 'run #2 · tests/test_auth.py',
    agent: 'editing tests/test_auth.py to silence auth failure…',
    human: 'SIGINT mid-turn · worktree discarded',
    why: 'Stopped sibling run before it could gut a second test file.',
  },
];

export function initCutFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxc');

  const head = h('div', 'fxc-head');
  head.innerHTML =
    '<div class="fxc-head__left">' +
    '<span class="fxc-head__kicker">session trace · 20m + 10m cut</span>' +
    '<span class="fxc-head__sub">click or hover any intervention node to inspect the training pair</span>' +
    '</div>' +
    '<div class="fxc-head__legend">' +
    '<span class="is-agent"><i></i>agent rollout (tests ✓)</span>' +
    '<span class="is-human"><i></i>your branch (shipped)</span>' +
    '<span class="is-delta"><i></i>correction delta (weights)</span>' +
    '</div>';

  const canvasWrap = h('div', 'fxc-viz');
  const svg = s('svg', { class: 'fxc-svg', 'aria-hidden': 'true' });
  const areaPath = s('path', { class: 'fxc-area' });
  const agentPath = s('path', { class: 'fxc-curve is-agent' });
  const humanPath = s('path', { class: 'fxc-curve is-human' });
  const divider = s('line', { class: 'fxc-divider' });
  const deltaGroup = s('g', { class: 'fxc-deltas' });
  const nodeGroup = s('g', { class: 'fxc-nodes' });
  const labelGroup = s('g', { class: 'fxc-labels' });
  svg.append(areaPath, divider, deltaGroup, agentPath, humanPath, nodeGroup, labelGroup);

  const pins = h('div', 'fxc-pins');
  canvasWrap.append(svg, pins);

  const card = h('div', 'fxc-inspector');
  const cardTag = h('span', 'fxc-inspector__tag');
  const cardFile = h('code', 'fxc-inspector__file');
  const cardWhy = h('span', 'fxc-inspector__why');
  const cardTop = h('div', 'fxc-inspector__top');
  cardTop.append(cardTag, cardFile, cardWhy);

  const cardDiff = h('div', 'fxc-inspector__diff');
  const rowAgent = h('div', 'fxc-inspector__row is-agent');
  const rowHuman = h('div', 'fxc-inspector__row is-human');
  cardDiff.append(rowAgent, rowHuman);

  const cardSteps = h('div', 'fxc-inspector__steps');
  card.append(cardTop, cardDiff, cardSteps);

  stage.append(head, canvasWrap, card);
  fig.prepend(stage);

  let activeIdx = 0;
  let autoTimer = 0;
  let userTouched = false;
  let visible = false;
  const pinButtons: HTMLButtonElement[] = [];
  const stepButtons: HTMLButtonElement[] = [];
  const deltaLines: SVGLineElement[] = [];

  const select = (idx: number) => {
    activeIdx = idx;
    const ev = EVENTS[idx];
    cardTag.className = `fxc-inspector__tag is-${ev.kind}`;
    cardTag.textContent = ev.tag;
    cardFile.textContent = ev.file;
    cardWhy.textContent = ev.why;
    rowAgent.innerHTML = `<span>agent proposed</span><code>${ev.agent}</code>`;
    rowHuman.innerHTML = `<span>you shipped</span><code>${ev.human}</code>`;
    pinButtons.forEach((b, i) => b.classList.toggle('is-active', i === idx));
    stepButtons.forEach((b, i) => b.classList.toggle('is-active', i === idx));
    deltaLines.forEach((l, i) => l.classList.toggle('is-active', i === idx));
  };

  EVENTS.forEach((ev, i) => {
    const pin = h('button', `fxc-pin is-${ev.kind}`) as HTMLButtonElement;
    pin.type = 'button';
    pin.innerHTML = `<span class="fxc-pin__dot"></span><span class="fxc-pin__lbl">${ev.tag}</span>`;
    pin.addEventListener('click', () => {
      userTouched = true;
      select(i);
    });
    pin.addEventListener('mouseenter', () => {
      userTouched = true;
      select(i);
    });
    pinButtons.push(pin);
    pins.append(pin);

    const sb = h('button', `fxc-step-btn is-${ev.kind}`, `${i + 1}. ${ev.tag}`) as HTMLButtonElement;
    sb.type = 'button';
    sb.addEventListener('click', () => {
      userTouched = true;
      select(i);
    });
    stepButtons.push(sb);
    cardSteps.append(sb);

    const dl = s('line', { class: `fxc-delta is-${ev.kind}` });
    deltaLines.push(dl);
    deltaGroup.append(dl);
  });

  const smoothCurve = (pts: [number, number][]): string => {
    if (pts.length === 0) return '';
    let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      const mx = (x0 + x1) / 2;
      d += ` C ${mx.toFixed(1)} ${y0.toFixed(1)}, ${mx.toFixed(1)} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    return d;
  };

  const layout = () => {
    const W = canvasWrap.clientWidth || 680;
    const narrow = W < 560;
    const H = narrow ? 230 : 250;
    canvasWrap.style.height = `${H}px`;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', String(W));
    svg.setAttribute('height', String(H));

    const padL = narrow ? 18 : 28;
    const padR = narrow ? 18 : 28;
    const padT = 26;
    const padB = 28;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    const px = (nx: number) => padL + nx * plotW;
    const py = (ny: number) => padT + ny * plotH;

    const startPt: [number, number] = [px(0.03), py(0.55)];
    const agentPts: [number, number][] = [startPt, ...EVENTS.map((e): [number, number] => [px(e.x), py(e.ay)]), [px(0.97), py(0.11)]];
    const humanPts: [number, number][] = [startPt, ...EVENTS.map((e): [number, number] => [px(e.x), py(e.hy)]), [px(0.97), py(0.81)]];

    agentPath.setAttribute('d', smoothCurve(agentPts));
    humanPath.setAttribute('d', smoothCurve(humanPts));

    // Closed polygon between agent curve and human curve for the shaded correction delta
    let areaD = smoothCurve(agentPts);
    for (let i = humanPts.length - 1; i >= 0; i--) {
      areaD += ` L ${humanPts[i][0].toFixed(1)} ${humanPts[i][1].toFixed(1)}`;
    }
    areaD += ' Z';
    areaPath.setAttribute('d', areaD);

    const divX = px(0.13);
    divider.setAttribute('x1', String(divX));
    divider.setAttribute('x2', String(divX));
    divider.setAttribute('y1', String(padT - 6));
    divider.setAttribute('y2', String(H - padB + 6));

    nodeGroup.innerHTML = '';
    labelGroup.innerHTML = '';

    // Prompt origin node
    const pDot = s('circle', { cx: startPt[0], cy: startPt[1], r: 4, class: 'fxc-origin' });
    nodeGroup.append(pDot);
    const pLbl = s('text', { x: startPt[0] + 6, y: startPt[1] - 8, class: 'fxc-svg-lbl' });
    pLbl.textContent = 'prompt (6w)';
    labelGroup.append(pLbl);

    // End labels
    const aEnd = agentPts[agentPts.length - 1];
    const hEnd = humanPts[humanPts.length - 1];
    const aLbl = s('text', { x: aEnd[0] - 6, y: aEnd[1] - 8, 'text-anchor': 'end', class: 'fxc-svg-lbl is-agent' });
    aLbl.textContent = 'unreviewed PR (breaks prod)';
    const hLbl = s('text', { x: hEnd[0] - 6, y: hEnd[1] - 10, 'text-anchor': 'end', class: 'fxc-svg-lbl is-human' });
    hLbl.textContent = 'merged diff (your weights)';
    labelGroup.append(aLbl, hLbl);

    EVENTS.forEach((ev, i) => {
      const x = px(ev.x);
      const ay = py(ev.ay);
      const hy = py(ev.hy);

      const dl = deltaLines[i];
      dl.setAttribute('x1', String(x));
      dl.setAttribute('y1', String(ay));
      dl.setAttribute('x2', String(x));
      dl.setAttribute('y2', String(hy));

      const aDot = s('circle', { cx: x, cy: ay, r: 3.2, class: 'fxc-a-dot' });
      nodeGroup.append(aDot);

      const pin = pinButtons[i];
      pin.style.left = `${x}px`;
      pin.style.top = `${hy}px`;
    });
  };

  layout();
  select(0);
  new ResizeObserver(() => layout()).observe(stage);

  const startCycle = () => {
    if (autoTimer || prefersReduced()) return;
    autoTimer = window.setInterval(() => {
      if (!userTouched && visible) {
        select((activeIdx + 1) % EVENTS.length);
      }
    }, 2800);
  };

  const stopCycle = () => {
    clearInterval(autoTimer);
    autoTimer = 0;
  };

  if (prefersReduced()) {
    stage.classList.add('is-on');
    return;
  }

  watchVisible(
    stage,
    (on) => {
      visible = on;
      if (on) {
        stage.classList.add('is-on');
        startCycle();
      } else {
        stopCycle();
      }
    },
    0.3,
  );
  void cssVar;
}
