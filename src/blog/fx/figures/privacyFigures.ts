import { createRandom, h, s } from './util';

// 19. Inbox Leak vs Trace Leak: The Decision-Boundary Clone Classifier
type CandidatePatch = {
  title: string;
  diff: string;
  inboxKnows: string;
  verdict: 'VETO' | 'APPROVE';
  conf: string;
  ruleFired: string;
  cloneReason: string;
};

const PATCHES: CandidatePatch[] = [
  {
    title: 'Patch A · loosen flaky webhook test',
    diff: `- assert resp.status == 403\n+ assert resp.status in (200, 403)  # unblock CI`,
    inboxKnows: 'Knows you received 3 emails about webhook sprint deadlines last month. Cannot predict your code review.',
    verdict: 'VETO',
    conf: '98.4% confidence',
    ruleFired: 'matches 84 past test-tampering rejections',
    cloneReason: 'Clone predicts immediate VETO + mid-run abort: operator never accepts widened status assertions to turn CI green.',
  },
  {
    title: 'Patch B · fallback to direct HTTP when proxy times out',
    diff: `except ProxyTimeoutError:\n    logger.warn("proxy slow, going direct")\n    return requests.post(url, json=body)`,
    inboxKnows: 'Knows the vendor contract for the egress proxy cost $36k/mo. Has zero model of your security posture.',
    verdict: 'VETO',
    conf: '96.9% confidence',
    ruleFired: 'matches 42 past fail-open security vetoes',
    cloneReason: 'Clone predicts VETO: operator treats silent fail-open fallbacks on security/egress paths as P1 blockers.',
  },
  {
    title: 'Patch C · 2-line CSS font-height fix with screenshot proof',
    diff: `.chat-reply { line-height: 1.45; }\n/* verified desktop + mobile in headless Chromium, 0 other files touched */`,
    inboxKnows: 'Knows someone complained about chat typography in Slack. Cannot tell if you will merge this diff.',
    verdict: 'APPROVE',
    conf: '94.2% confidence',
    ruleFired: 'matches "small asks get small diffs" + live visual proof',
    cloneReason: 'Clone predicts APPROVE in <30s: minimal blast radius (+1/-0), zero test/config churn, live render attached.',
  },
];

export function initCloneFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxcl');

  const head = h('div', 'fxcl-head');
  head.innerHTML =
    '<span class="fxcl-head__title">leaked inbox vs leaked trace archive · test the behavioral clone</span>' +
    '<div class="fxcl-patches"></div>';

  const patchTabs = head.querySelector<HTMLElement>('.fxcl-patches')!;
  const codeBox = h('pre', 'fxcl-diff');
  const cols = h('div', 'fxcl-cols');

  const colInbox = h('div', 'fxcl-col is-inbox');
  const colTrace = h('div', 'fxcl-col is-trace');
  cols.append(colInbox, colTrace);

  stage.append(head, codeBox, cols);
  fig.prepend(stage);

  const btns: HTMLButtonElement[] = [];
  const select = (idx: number) => {
    const p = PATCHES[idx];
    btns.forEach((b, i) => b.classList.toggle('is-active', i === idx));
    codeBox.textContent = p.diff;
    colInbox.innerHTML =
      '<div class="fxcl-col__hdr"><span>attacker with your leaked inbox</span><b>past messages only</b></div>' +
      `<div class="fxcl-col__body">${p.inboxKnows}</div>` +
      '<div class="fxcl-col__pred is-unknown">prediction on new diff: <b>50 / 50 guess</b></div>';

    colTrace.innerHTML =
      '<div class="fxcl-col__hdr"><span>attacker with your leaked trace log</span><b>trained on 1,000 decisions</b></div>' +
      `<div class="fxcl-col__body">${p.cloneReason}</div>` +
      `<div class="fxcl-col__pred is-${p.verdict.toLowerCase()}">clone prediction: <b>${p.verdict} (${p.conf})</b> · <code>${p.ruleFired}</code></div>`;
  };

  PATCHES.forEach((p, i) => {
    const b = h('button', 'fxcl-btn', p.title) as HTMLButtonElement;
    b.type = 'button';
    b.addEventListener('click', () => select(i));
    btns.push(b);
    patchTabs.append(b);
  });

  select(0);
}

// 20. The Decision-Boundary Phase Space (2D Contour of Your Taste)
export function initPhaseSpaceFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxps');

  const head = h('div', 'fxps-head');
  head.innerHTML =
    '<div class="fxps-head__left">' +
    '<span class="fxps-head__title">your decision boundary in phase space · 240 historical diffs</span>' +
    '<span class="fxps-head__sub">every accept (green) and veto (red) carves the mathematical contour of your taste</span>' +
    '</div>' +
    '<div class="fxps-modes">' +
    '<button type="button" class="fxps-btn is-active" data-m="sharp">morning boundary (strict)</button>' +
    '<button type="button" class="fxps-btn" data-m="drift">1 a.m. fatigued boundary (leaky)</button>' +
    '</div>';

  const wrap = h('div', 'fxps-wrap');
  const svg = s('svg', { class: 'fxps-svg', viewBox: '0 0 680 220', 'aria-hidden': 'true' });

  const approveZone = s('path', { class: 'fxps-zone' });
  const boundaryCurve = s('path', { class: 'fxps-boundary' });
  const ptsG = s('g');
  const axisG = s('g', { class: 'fxps-axis' });

  const xLbl = s('text', { x: 350, y: 212, 'text-anchor': 'middle' });
  xLbl.textContent = 'blast radius & scope creep (files touched, config hunks, fallback paths) →';
  const yLbl = s('text', { x: 14, y: 110, 'text-anchor': 'middle', transform: 'rotate(-90 14 110)' });
  yLbl.textContent = '↑ verification & test fidelity';
  axisG.append(xLbl, yLbl);

  svg.append(approveZone, ptsG, boundaryCurve, axisG);
  wrap.append(svg);

  const foot = h('div', 'fxps-foot');
  stage.append(head, wrap, foot);
  fig.prepend(stage);

  const r = createRandom(20261025);
  type SamplePt = { bx: number; vy: number; el: SVGCircleElement };
  const samples: SamplePt[] = [];

  const thresholdStrict = (x: number) => 0.18 + 0.68 * Math.pow(x, 1.25);
  const thresholdDrift = (x: number) => 0.06 + 0.38 * Math.pow(x, 1.5);

  const px = (x: number) => 42 + x * 612;
  const py = (y: number) => 190 - y * 168;

  for (let i = 0; i < 180; i++) {
    const bx = r();
    const vy = r();
    const c = s('circle', { cx: px(bx).toFixed(1), cy: py(vy).toFixed(1), r: 3 });
    ptsG.append(c);
    samples.push({ bx, vy, el: c });
  }

  const btns = Array.from(head.querySelectorAll<HTMLButtonElement>('.fxps-btn'));

  const render = (mode: 'sharp' | 'drift') => {
    btns.forEach((b) => b.classList.toggle('is-active', b.dataset.m === mode));
    const fn = mode === 'sharp' ? thresholdStrict : thresholdDrift;

    const curvePts: [number, number][] = [];
    for (let k = 0; k <= 40; k++) {
      const x = k / 40;
      const y = Math.min(0.98, fn(x));
      curvePts.push([px(x), py(y)]);
    }

    const d = curvePts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    boundaryCurve.setAttribute('d', d);
    approveZone.setAttribute('d', `${d} L ${px(1)} ${py(1)} L ${px(0)} ${py(1)} Z`);

    let leaked = 0;
    samples.forEach((sp) => {
      const strictOk = sp.vy >= thresholdStrict(sp.bx);
      const nowOk = sp.vy >= fn(sp.bx);
      if (!strictOk && nowOk) leaked++;
      sp.el.setAttribute(
        'class',
        nowOk ? (strictOk ? 'fxps-pt is-approve' : 'fxps-pt is-slip') : 'fxps-pt is-veto',
      );
    });

    foot.innerHTML =
      mode === 'sharp'
        ? '<b>Your decision boundary:</b> High-blast-radius patches require live-surface proof to cross into the green approval zone. Anyone with your trace log can fit this exact curve.'
        : `<b>Under cognitive drift:</b> The boundary sags downward; <b>${leaked} high-risk patches</b> (amber) slip across the line and become next week’s reverts.`;
  };

  btns.forEach((b) => b.addEventListener('click', () => render(b.dataset.m as 'sharp' | 'drift')));
  render('sharp');
}
