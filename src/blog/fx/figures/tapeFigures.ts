import { h, s } from './util';

// 6. Packet X-Ray: What leaves your laptop on git push
type LayerSpec = {
  id: string;
  label: string;
  source: string;
  badge: string;
  kind: 'git' | 'otel' | 'attest' | 'broker';
  json: string;
  note: string;
};

const LAYERS: LayerSpec[] = [
  {
    id: 'git',
    label: '1. git push diff (what you think you sent)',
    source: 'git push origin fix/upload-retries',
    badge: '18 lines · public to team',
    kind: 'git',
    json: `commit 7d21f4a (HEAD -> fix/upload-retries)\n+ if r.status_code >= 500:\n+     time.sleep(jitter_backoff(attempt, cap=8.0))`,
    note: 'Git only sees the clean final commit. Every dead end and manual rescue is invisible here.',
  },
  {
    id: 'otel',
    label: '2. Copilot enterprise OTel stream (managed settings)',
    source: 'telemetry.capture.{identity,prompts,toolArguments,toolOutput,policyDetail}',
    badge: 'override local config · silent',
    kind: 'otel',
    json: `{\n  "user.name": "ivan-charapanau", "process.user.name": "everlier", "host.name": "fedora",\n  "prompts": ["add retries to the upload client", "no, status >= 400 breaks auth"],\n  "toolArguments": ["edit upload_client.py", "edit config/prod.yaml", "edit test_upload.py"],\n  "policyDetail": { "sandbox_paths": ["/home/everlier/code/repo"] }\n}`,
    note: 'Explicit managed settings override local flags, attaching OS identity and every rejected tool call.',
  },
  {
    id: 'attest',
    label: '3. chainloop trace signed attestation',
    source: 'chainloop trace hook on git push',
    badge: 'before/after file snapshots',
    kind: 'attest',
    json: `{\n  "attribution": { "agent_lines": 5, "human_rewritten_lines": 11, "reverted_files": ["config/prod.yaml"] },\n  "vendored_inputs": ["specs/issue-3543.md", "skills/discipline/SKILL.md", "AGENTS.md"],\n  "signature": "sigstore://sha256:9f8ca2...e41b"\n}`,
    note: 'Snapshots every file before and after each edit to attribute lines between agent and human, plus loaded skills.',
  },
  {
    id: 'broker',
    label: '4. Trajector / lab DPO harvest',
    source: '127.0.0.1:41100 local proxy spool',
    badge: 'human_correction event',
    kind: 'broker',
    json: `{\n  "event_id": "9c2e-t4", "correction_reason": "wrong_root_cause_diagnosis",\n  "rejected_action": { "diff": "if r.status_code >= 400", "retained_lines": 0 },\n  "preferred_action": { "diff": "if r.status_code >= 500", "retained_lines": 5 },\n  "license": "perpetual_commercial_training"\n}`,
    note: 'Turns your manual intervention into a scored preference pair ready for SFT and reinforcement learning.',
  },
];

export function initXrayFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxx');

  const head = h('div', 'fxx-head');
  head.innerHTML =
    '<span class="fxx-head__title">packet x-ray · what leaves your laptop on a single commit</span>' +
    '<span class="fxx-head__sub">select a telemetry layer to inspect the payload underneath git push</span>';

  const body = h('div', 'fxx-body');
  const stack = h('div', 'fxx-stack');
  const inspector = h('div', 'fxx-inspector');
  const inspHead = h('div', 'fxx-inspector__head');
  const inspCode = h('pre', 'fxx-inspector__code');
  const inspNote = h('div', 'fxx-inspector__note');
  inspector.append(inspHead, inspCode, inspNote);

  const btns: HTMLButtonElement[] = [];
  const select = (idx: number) => {
    const l = LAYERS[idx];
    btns.forEach((b, i) => b.classList.toggle('is-active', i === idx));
    inspHead.innerHTML = `<code>${l.source}</code><span class="fxx-badge is-${l.kind}">${l.badge}</span>`;
    inspCode.textContent = l.json;
    inspNote.textContent = l.note;
  };

  LAYERS.forEach((l, i) => {
    const b = h('button', `fxx-layer is-${l.kind}`) as HTMLButtonElement;
    b.type = 'button';
    b.innerHTML = `<span class="fxx-layer__lbl">${l.label}</span><span class="fxx-layer__tag">${l.badge}</span>`;
    b.addEventListener('click', () => select(i));
    b.addEventListener('mouseenter', () => select(i));
    btns.push(b);
    stack.append(b);
  });

  body.append(stack, inspector);
  stage.append(head, body);
  fig.prepend(stage);
  select(1);
}

// 8. The Role-Replacement Hill-Climber (24-month slider)
export function initHillclimbFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxh');

  const head = h('div', 'fxh-head');
  head.innerHTML =
    '<div class="fxh-head__left">' +
    '<span class="fxh-head__title">the enterprise hill-climber · 500 engineers over 24 months</span>' +
    '<span class="fxh-head__sub">drag the timeline to watch staff vetoes compile into company-owned workflow weights</span>' +
    '</div>' +
    '<div class="fxh-slider-wrap">' +
    '<label class="fxh-month-lbl">Month <b class="fxh-m">0</b></label>' +
    '<input type="range" class="fxh-slider" min="0" max="24" step="1" value="6" aria-label="Months of enterprise trace capture" />' +
    '</div>';

  const kpis = h('div', 'fxh-kpis');
  kpis.innerHTML =
    '<div class="fxh-kpi"><span class="fxh-kpi__lbl">staff vetoes logged</span><b class="fxh-kpi__val is-vetoes">0</b></div>' +
    '<div class="fxh-kpi"><span class="fxh-kpi__lbl">company harness pass rate</span><b class="fxh-kpi__val is-pass">38%</b></div>' +
    '<div class="fxh-kpi"><span class="fxh-kpi__lbl">senior seats required</span><b class="fxh-kpi__val is-seats">500</b></div>' +
    '<div class="fxh-kpi"><span class="fxh-kpi__lbl">departing engineer keeps</span><b class="fxh-kpi__val is-zero">0 weights</b></div>';

  const viz = h('div', 'fxh-viz');
  const grid = h('div', 'fxh-dots');
  const dots: HTMLElement[] = [];
  for (let i = 0; i < 60; i++) {
    const d = h('i', 'fxh-dot');
    dots.push(d);
    grid.append(d);
  }
  const legend = h('div', 'fxh-legend');
  legend.innerHTML =
    '<span><i class="is-human"></i>senior SWE seat</span>' +
    '<span><i class="is-agent"></i>role automated by company harness</span>';
  viz.append(grid, legend);

  stage.append(head, kpis, viz);
  fig.prepend(stage);

  const slider = head.querySelector<HTMLInputElement>('.fxh-slider')!;
  const mEl = head.querySelector<HTMLElement>('.fxh-m')!;
  const vEl = kpis.querySelector<HTMLElement>('.is-vetoes')!;
  const pEl = kpis.querySelector<HTMLElement>('.is-pass')!;
  const sEl = kpis.querySelector<HTMLElement>('.is-seats')!;

  const update = (m: number) => {
    mEl.textContent = String(m);
    const vetoes = Math.round(m * 6250);
    const pass = Math.round(38 + 56 * (1 - Math.exp(-m / 9)));
    const seats = Math.max(65, Math.round(500 * Math.exp(-m / 13.5)));
    vEl.textContent = vetoes.toLocaleString('en-US');
    pEl.textContent = `${pass}%`;
    sEl.textContent = `${seats} / 500`;

    const keepDots = Math.round((seats / 500) * dots.length);
    dots.forEach((d, i) => {
      d.classList.toggle('is-replaced', i >= keepDots);
    });
  };

  slider.addEventListener('input', () => update(Number(slider.value)));
  update(6);
}

// 9. The Compounding Ledger Calculator (3-year trajectory)
export function initCompoundingFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxlc');

  const head = h('div', 'fxlc-head');
  head.innerHTML =
    '<div class="fxlc-head__left">' +
    '<span class="fxlc-head__title">the 3-year compounding ledger · 1,000 agent runs / month</span>' +
    '<span class="fxlc-head__sub">stateless retry loop vs compiling 1 rule per week into your personal harness</span>' +
    '</div>' +
    '<div class="fxlc-rate">' +
    '<span>compile cadence:</span>' +
    '<button type="button" class="fxlc-btn" data-r="1">1 rule / mo</button>' +
    '<button type="button" class="fxlc-btn is-active" data-r="4">1 rule / wk</button>' +
    '<button type="button" class="fxlc-btn" data-r="8">2 rules / wk</button>' +
    '</div>';

  const chartWrap = h('div', 'fxlc-chart');
  const svg = s('svg', { class: 'fxlc-svg', viewBox: '0 0 680 210', 'aria-hidden': 'true' });
  const gridG = s('g', { class: 'fxlc-grid' });
  const area = s('path', { class: 'fxlc-area' });
  const flatLine = s('path', { class: 'fxlc-line is-flat' });
  const compLine = s('path', { class: 'fxlc-line is-comp' });
  const lblFlat = s('text', { class: 'fxlc-lbl is-flat' });
  const lblComp = s('text', { class: 'fxlc-lbl is-comp' });
  svg.append(gridG, area, flatLine, compLine, lblFlat, lblComp);

  for (let m = 0; m <= 36; m += 12) {
    const x = 44 + (m / 36) * 600;
    const l = s('line', { x1: x, y1: 20, x2: x, y2: 176 });
    const t = s('text', { x, y: 194, 'text-anchor': 'middle', class: 'fxlc-axis' });
    t.textContent = m === 0 ? 'Day 1' : `Year ${m / 12}`;
    gridG.append(l, t);
  }

  const stats = h('div', 'fxlc-stats');
  stats.innerHTML =
    '<div class="fxlc-stat is-flat"><span>stateless default (year 3)</span><b>34% first-pass yield · 0 portable gates</b></div>' +
    '<div class="fxlc-stat is-comp"><span>compiled harness (year 3)</span><b class="fxlc-comp-out">91% first-pass yield · 144 portable gates</b></div>';

  chartWrap.append(svg);
  stage.append(head, chartWrap, stats);
  fig.prepend(stage);

  const btns = Array.from(head.querySelectorAll<HTMLButtonElement>('.fxlc-btn'));
  const compOut = stats.querySelector<HTMLElement>('.fxlc-comp-out')!;

  const render = (rulesPerMo: number) => {
    btns.forEach((b) => b.classList.toggle('is-active', Number(b.dataset.r) === rulesPerMo));
    const px = (m: number) => 44 + (m / 36) * 600;
    const py = (pct: number) => 176 - ((pct - 25) / 75) * 148;

    const flatY = py(34);
    flatLine.setAttribute('d', `M ${px(0)} ${flatY} L ${px(36)} ${flatY}`);
    lblFlat.setAttribute('x', String(px(36) - 6));
    lblFlat.setAttribute('y', String(flatY - 7));
    lblFlat.setAttribute('text-anchor', 'end');
    lblFlat.textContent = 'stateless operator (34% · same bugs on Day 1,095)';

    const pts: [number, number][] = [];
    let finalYield = 34;
    for (let m = 0; m <= 36; m++) {
      const rules = m * rulesPerMo;
      const yld = 34 + 62 * (1 - Math.exp(-rules / 55));
      if (m === 36) finalYield = Math.round(yld);
      pts.push([px(m), py(yld)]);
    }

    const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
    compLine.setAttribute('d', d);
    area.setAttribute('d', `${d} L ${px(36)} ${flatY} L ${px(0)} ${flatY} Z`);

    const last = pts[pts.length - 1];
    lblComp.setAttribute('x', String(last[0] - 6));
    lblComp.setAttribute('y', String(last[1] - 8));
    lblComp.setAttribute('text-anchor', 'end');
    const totalGates = 36 * rulesPerMo;
    lblComp.textContent = `your harness (${finalYield}% yield · ${totalGates} compiled gates)`;
    compOut.textContent = `${finalYield}% first-pass yield · ${totalGates} portable gates`;
  };

  btns.forEach((b) => b.addEventListener('click', () => render(Number(b.dataset.r))));
  render(4);
}
