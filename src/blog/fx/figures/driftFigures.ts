import { h, s } from './util';

// 15. The 1 a.m. Operator Flight Recorder (Synchronized 4-Track Timeline)
type HourSample = {
  t: string;
  trees: number;
  words: number;
  reviewSec: number;
  revertPct: number;
  note: string;
};

const HOURS: HourSample[] = [
  { t: '09:00', trees: 2, words: 54, reviewSec: 210, revertPct: 3, note: 'Fresh focus: detailed specs, caller paths checked, 1 bad hunk rejected.' },
  { t: '11:30', trees: 3, words: 46, reviewSec: 185, revertPct: 4, note: 'Steady cruise: tests and full git diff inspected before every merge.' },
  { t: '14:00', trees: 4, words: 38, reviewSec: 150, revertPct: 5, note: 'Post-lunch parallelization: 4 worktrees active, gates holding clean.' },
  { t: '16:30', trees: 6, words: 29, reviewSec: 115, revertPct: 7, note: 'Context switching rises: prompts shorten, minor config drift waved through.' },
  { t: '19:00', trees: 7, words: 21, reviewSec: 75, revertPct: 11, note: 'Evening push: skimming 200-line diffs by test status instead of reading callers.' },
  { t: '21:30', trees: 9, words: 12, reviewSec: 38, revertPct: 19, note: 'Overload onset: "fix the build" one-liners; acceptance threshold dropping.' },
  { t: '23:30', trees: 10, words: 7, reviewSec: 19, revertPct: 29, note: 'Fatigue blindness: 300-line diff merged in 19 seconds because CI is green.' },
  { t: '01:00', trees: 11, words: 5, reviewSec: 11, revertPct: 42, note: '1 a.m. lid-close: rubber-stamping branches; revert spike lands 48h later.' },
];

export function initRecorderFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxfr');

  const head = h('div', 'fxfr-head');
  head.innerHTML =
    '<div class="fxfr-head__left">' +
    '<span class="fxfr-head__title">operator flight recorder · 09:00 to 01:00 session telemetry</span>' +
    '<span class="fxfr-head__sub">scrub across the workday to see operator degradation precede the +48h revert spike</span>' +
    '</div>' +
    '<div class="fxfr-scrubber">' +
    '<span class="fxfr-time">01:00</span>' +
    '<input type="range" class="fxfr-slider" min="0" max="7" step="1" value="7" aria-label="Time of day" />' +
    '</div>';

  const tracks = h('div', 'fxfr-tracks');
  const svg = s('svg', { class: 'fxfr-svg', viewBox: '0 0 680 185', 'aria-hidden': 'true' });

  const cursorLine = s('line', { class: 'fxfr-cursor', y1: 12, y2: 165 });
  const pTrees = s('path', { class: 'fxfr-line is-trees' });
  const pWords = s('path', { class: 'fxfr-line is-words' });
  const pRev = s('path', { class: 'fxfr-line is-rev' });
  const pSpike = s('path', { class: 'fxfr-line is-spike' });
  const dotsG = s('g');
  svg.append(pTrees, pWords, pRev, pSpike, cursorLine, dotsG);

  const px = (i: number) => 48 + (i / (HOURS.length - 1)) * 596;
  const buildPath = (vals: number[], max: number, top: number, bot: number) =>
    vals
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${px(i).toFixed(1)} ${(bot - (v / max) * (bot - top)).toFixed(1)}`)
      .join(' ');

  pTrees.setAttribute('d', buildPath(HOURS.map((h) => h.trees), 12, 18, 52));
  pWords.setAttribute('d', buildPath(HOURS.map((h) => h.words), 60, 62, 96));
  pRev.setAttribute('d', buildPath(HOURS.map((h) => h.reviewSec), 220, 106, 136));
  pSpike.setAttribute('d', buildPath(HOURS.map((h) => h.revertPct), 45, 118, 162));

  HOURS.forEach((hr, i) => {
    const t = s('text', { x: px(i), y: 179, 'text-anchor': 'middle', class: 'fxfr-axis' });
    t.textContent = hr.t;
    svg.append(t);
  });

  const readouts = h('div', 'fxfr-readouts');
  readouts.innerHTML =
    '<div class="fxfr-stat"><span>active worktrees</span><b class="is-trees">11</b></div>' +
    '<div class="fxfr-stat"><span>prompt specificity</span><b class="is-words">5 words</b></div>' +
    '<div class="fxfr-stat"><span>diff review time</span><b class="is-rev">11s</b></div>' +
    '<div class="fxfr-stat is-alert"><span>revert rate (+48h lag)</span><b class="is-spike">42%</b></div>';

  const foot = h('div', 'fxfr-foot');
  tracks.append(svg);
  stage.append(head, readouts, tracks, foot);
  fig.prepend(stage);

  const slider = head.querySelector<HTMLInputElement>('.fxfr-slider')!;
  const timeEl = head.querySelector<HTMLElement>('.fxfr-time')!;
  const bTrees = readouts.querySelector<HTMLElement>('.is-trees')!;
  const bWords = readouts.querySelector<HTMLElement>('.is-words')!;
  const bRev = readouts.querySelector<HTMLElement>('.is-rev')!;
  const bSpike = readouts.querySelector<HTMLElement>('.is-spike')!;

  const update = (idx: number) => {
    const hr = HOURS[idx];
    const x = px(idx);
    cursorLine.setAttribute('x1', String(x));
    cursorLine.setAttribute('x2', String(x));
    timeEl.textContent = hr.t;
    bTrees.textContent = `${hr.trees} parallel`;
    bWords.textContent = `${hr.words} words avg`;
    bRev.textContent = `${hr.reviewSec}s / PR`;
    bSpike.textContent = `${hr.revertPct}% reverted`;
    stage.classList.toggle('is-fatigued', idx >= 5);
    foot.innerHTML = `<b>${hr.t} log state:</b> ${hr.note}`;
  };

  slider.addEventListener('input', () => update(Number(slider.value)));
  update(7);
}

// 16. The Tired Approval Diff (Morning Brain vs 1 a.m. Brain)
export function initFatigueDiffFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxfd');

  const head = h('div', 'fxfd-head');
  head.innerHTML =
    '<span class="fxfd-head__title">the same 300-line diff · perceived at 10:00 a.m. vs 01:00 a.m.</span>' +
    '<div class="fxfd-tabs">' +
    '<button type="button" class="fxfd-tab is-active" data-mode="fresh">10:00 a.m. · sharp operator (vetoes)</button>' +
    '<button type="button" class="fxfd-tab" data-mode="tired">01:00 a.m. · fatigued operator (merges)</button>' +
    '</div>';

  const banner = h('div', 'fxfd-ci');
  banner.innerHTML =
    '<span class="fxfd-ci__badge">✓ 18 / 18 checks passing</span>' +
    '<span class="fxfd-ci__meta">branch <code>feat/token-refresh</code> · +284 −19 across 6 files</span>';

  const code = h('div', 'fxfd-code');
  code.innerHTML =
    '<div class="fxfd-line is-ctx"><span>118</span><code>async function refreshSession(userId: string, token: string) {</code></div>' +
    '<div class="fxfd-line is-add"><span>119</span><code>+   const cached = await redis.get(`sess:${token}`);</code></div>' +
    '<div class="fxfd-line is-hazard"><span>120</span><code>+   if (cached) return JSON.parse(cached);</code><em class="fxfd-flag">⚠ caller tenant check skipped</em></div>' +
    '<div class="fxfd-line is-add"><span>121</span><code>+   try {</code></div>' +
    '<div class="fxfd-line is-add"><span>122</span><code>+     return await authClient.verifyAndRotate(userId, token);</code></div>' +
    '<div class="fxfd-line is-hazard"><span>123</span><code>+   } catch { return { userId, degraded: true }; }</code><em class="fxfd-flag">⚠ fail-open catch swallows 401</em></div>' +
    '<div class="fxfd-line is-ctx"><span>124</span><code>}</code></div>';

  const foot = h('div', 'fxfd-foot');
  stage.append(head, banner, code, foot);
  fig.prepend(stage);

  const tabs = Array.from(head.querySelectorAll<HTMLButtonElement>('.fxfd-tab'));
  const setMode = (mode: 'fresh' | 'tired') => {
    stage.dataset.mode = mode;
    tabs.forEach((t) => t.classList.toggle('is-active', t.dataset.mode === mode));
    foot.innerHTML =
      mode === 'fresh'
        ? '<b>10:00 a.m. trace:</b> You ignore the green CI badge, trace callers of <code>refreshSession</code>, spot the missing <code>userId</code> binding and fail-open <code>catch</code>, and reject the PR.'
        : '<b>01:00 a.m. trace:</b> With 10 worktrees open, your eyes lock onto <code>✓ 18/18 checks passing</code>. The two subtle hazards blur into boilerplate, you click Merge, and the revert lands Thursday.';
  };

  tabs.forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode as 'fresh' | 'tired')));
  setMode('fresh');
}

// 17. The Shrinking Human Surface Area (Quarter-by-Quarter Allocation)
type QuarterSpec = {
  q: string;
  compiledPct: number;
  manualPct: number;
  highEntropyPct: number;
  newlyCompiled: string;
  humanFocus: string;
};

const QUARTERS: QuarterSpec[] = [
  {
    q: 'Q1 2026',
    compiledPct: 12,
    manualPct: 68,
    highEntropyPct: 20,
    newlyCompiled: 'formatters, static types, basic unit test runner',
    humanFocus: '68% of week spent manually catching wrong config paths, CI polling, lockfile edits, and bad retries.',
  },
  {
    q: 'Q2 2026',
    compiledPct: 38,
    manualPct: 36,
    highEntropyPct: 26,
    newlyCompiled: '+ env-before-code, container mount paths, blocking gh pr checks --watch',
    humanFocus: 'Routine environment rescues disappear; human reviews focus on migration graphs and diff residue.',
  },
  {
    q: 'Q3 2026',
    compiledPct: 62,
    manualPct: 14,
    highEntropyPct: 24,
    newlyCompiled: '+ alembic head linearity, full-diff residue strip, off-limits tests & graders',
    humanFocus: 'Mechanical code-review vetoes drop to 14%; attention shifts to live-surface proof and architecture.',
  },
  {
    q: 'Q4 2026',
    compiledPct: 78,
    manualPct: 4,
    highEntropyPct: 18,
    newlyCompiled: '+ no-proxy-done live verification, post-deploy watch, operator drift canary',
    humanFocus: '90% of repeatable vetoes compiled into the floor. Human bandwidth corners onto pure high-entropy bets.',
  },
];

export function initSurfaceFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxsf');

  const head = h('div', 'fxsf-head');
  head.innerHTML =
    '<span class="fxsf-head__title">the shrinking human surface area · where 100% of review attention goes</span>' +
    '<div class="fxsf-tabs"></div>';

  const tabsWrap = head.querySelector<HTMLElement>('.fxsf-tabs')!;
  const barWrap = h('div', 'fxsf-bar');
  const segComp = h('div', 'fxsf-seg is-comp');
  const segMan = h('div', 'fxsf-seg is-man');
  const segHigh = h('div', 'fxsf-seg is-high');
  barWrap.append(segComp, segMan, segHigh);

  const legend = h('div', 'fxsf-legend');
  legend.innerHTML =
    '<span class="is-comp"><i></i>compiled into harness checks</span>' +
    '<span class="is-man"><i></i>manual human bug-catching (uncompiled)</span>' +
    '<span class="is-high"><i></i>unformalizable high-entropy judgment (what to build &amp; risk)</span>';

  const meta = h('div', 'fxsf-meta');
  stage.append(head, barWrap, legend, meta);
  fig.prepend(stage);

  const btns: HTMLButtonElement[] = [];
  const select = (idx: number) => {
    const q = QUARTERS[idx];
    btns.forEach((b, i) => b.classList.toggle('is-active', i === idx));
    segComp.style.width = `${q.compiledPct}%`;
    segComp.innerHTML = `<b>${q.compiledPct}%</b><span>compiled checks</span>`;
    segMan.style.width = `${q.manualPct}%`;
    segMan.innerHTML = q.manualPct >= 10 ? `<b>${q.manualPct}%</b><span>manual vetoes</span>` : `<b>${q.manualPct}%</b>`;
    segHigh.style.width = `${q.highEntropyPct}%`;
    segHigh.innerHTML = `<b>${q.highEntropyPct}%</b><span>high-entropy taste</span>`;

    meta.innerHTML =
      `<div class="fxsf-meta__row"><span>compiled this quarter</span><code>${q.newlyCompiled}</code></div>` +
      `<div class="fxsf-meta__row"><span>where "you" sit now</span><span>${q.humanFocus}</span></div>`;
  };

  QUARTERS.forEach((q, i) => {
    const b = h('button', 'fxsf-tab', q.q) as HTMLButtonElement;
    b.type = 'button';
    b.addEventListener('click', () => select(i));
    btns.push(b);
    tabsWrap.append(b);
  });

  select(3);
}
