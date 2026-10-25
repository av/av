import { h, prefersReduced, s, watchVisible } from './util';

// 1. Arbitrage Ticker: $1/M raw token payout vs AI lab preference-pair extraction.
export function initArbitrageFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxa');

  const head = h('div', 'fxa-head');
  head.innerHTML =
    '<span class="fxa-head__title">trace arbitrage · 1 real session (2.0M tokens · 4 human vetoes)</span>' +
    '<div class="fxa-controls">' +
    '<button type="button" class="fxa-btn is-active" data-mult="1">1 session</button>' +
    '<button type="button" class="fxa-btn" data-mult="100">100 sessions</button>' +
    '<button type="button" class="fxa-btn" data-mult="1000">1,000 sessions</button>' +
    '</div>';

  const grid = h('div', 'fxa-grid');

  const left = h('div', 'fxa-col is-dev');
  left.innerHTML =
    '<div class="fxa-col__kicker">contributor payout · raw token meter</div>' +
    '<div class="fxa-col__big"><b class="fxa-usd">$2.00</b><span>USDC · $1.00 / 1M tokens</span></div>' +
    '<div class="fxa-stream">' +
    '<div class="fxa-turn is-noise"><span>turn 01 · read 14 files (420k tok)</span><b>$0.42 · noise</b></div>' +
    '<div class="fxa-turn is-noise"><span>turn 02 · grep + draft patch (510k tok)</span><b>$0.51 · noise</b></div>' +
    '<div class="fxa-turn is-veto"><span>turn 03 · human veto: wrong root cause (18k tok)</span><b>$0.02 · VETO #1</b></div>' +
    '<div class="fxa-turn is-noise"><span>turn 04 · test run + retry loop (640k tok)</span><b>$0.64 · noise</b></div>' +
    '<div class="fxa-turn is-veto"><span>turn 05 · human edit: clamp refill window (12k tok)</span><b>$0.01 · VETO #2</b></div>' +
    '<div class="fxa-turn is-veto"><span>turn 06 · human revert: config/prod.yaml (9k tok)</span><b>$0.01 · VETO #3</b></div>' +
    '<div class="fxa-turn is-veto"><span>turn 07 · human restore: 422 assertion (11k tok)</span><b>$0.01 · VETO #4</b></div>' +
    '<div class="fxa-turn is-noise"><span>turn 08 · final test pass + commit (380k tok)</span><b>$0.38 · noise</b></div>' +
    '</div>' +
    '<div class="fxa-foot">97.5% of payout is billed on routine context reads; the 4 corrections earn <b>$0.05</b> total.</div>';

  const right = h('div', 'fxa-col is-lab');
  right.innerHTML =
    '<div class="fxa-col__kicker">lab buyer view · extracted preference pairs</div>' +
    '<div class="fxa-col__big"><b class="fxa-pairs">4 pairs</b><span>perpetual commercial weight license</span></div>' +
    '<div class="fxa-cards">' +
    '<div class="fxa-pair"><code>DPO_01</code><span>rejected: redis counter persist → preferred: clamp wall-clock refill</span><b>score 84/100</b></div>' +
    '<div class="fxa-pair"><code>DPO_02</code><span>rejected: retry status &gt;= 400 → preferred: retry 5xx with jitter</span><b>score 91/100</b></div>' +
    '<div class="fxa-pair"><code>DPO_03</code><span>rejected: leave debug timeout=300 → preferred: revert trajectory residue</span><b>score 88/100</b></div>' +
    '<div class="fxa-pair"><code>DPO_04</code><span>rejected: widen assert in (200,422) → preferred: hold test invariant</span><b>score 95/100</b></div>' +
    '</div>' +
    '<div class="fxa-meter">' +
    '<div class="fxa-meter__row"><span>developer keeps</span><i class="is-dev"><u style="transform:scaleX(0.02)"></u></i><b class="fxa-dev-keep">$2.00 · 0 weights</b></div>' +
    '<div class="fxa-meter__row"><span>buyer compounds</span><i class="is-lab"><u class="fxa-lab-bar" style="transform:scaleX(0.32)"></u></i><b class="fxa-lab-keep">+4 permanent failure modes closed</b></div>' +
    '</div>';

  grid.append(left, right);
  stage.append(head, grid);
  fig.prepend(stage);

  const usdEl = left.querySelector<HTMLElement>('.fxa-usd')!;
  const pairsEl = right.querySelector<HTMLElement>('.fxa-pairs')!;
  const devKeep = right.querySelector<HTMLElement>('.fxa-dev-keep')!;
  const labKeep = right.querySelector<HTMLElement>('.fxa-lab-keep')!;
  const labBar = right.querySelector<HTMLElement>('.fxa-lab-bar')!;
  const btns = Array.from(head.querySelectorAll<HTMLButtonElement>('.fxa-btn'));

  const setMult = (m: number) => {
    btns.forEach((b) => b.classList.toggle('is-active', Number(b.dataset.mult) === m));
    const usd = (2 * m).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const pairs = (4 * m).toLocaleString('en-US');
    usdEl.textContent = `$${usd}`;
    pairsEl.textContent = `${pairs} pairs`;
    devKeep.textContent = `$${usd} · 0 weights`;
    labKeep.textContent =
      m === 1
        ? '+4 permanent failure modes closed'
        : m === 100
          ? '400 DPO pairs · fine-tunes repo specialist'
          : '4,000 DPO pairs · frontier SFT/RL checkpoint';
    labBar.style.transform = `scaleX(${m === 1 ? 0.32 : m === 100 ? 0.68 : 0.98})`;
  };

  btns.forEach((b) => b.addEventListener('click', () => setMult(Number(b.dataset.mult))));
}

// 2. The 40-Year Employment Bargain Slider (1985–2024 vs 2026+)
export function initBargainFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxb');

  const head = h('div', 'fxb-head');
  head.innerHTML =
    '<span class="fxb-head__title">what crosses the exit door when you quit</span>' +
    '<div class="fxb-switch" role="tablist">' +
    '<button type="button" class="fxb-tab is-active" data-era="old">1985 – 2024 · the old deal</button>' +
    '<button type="button" class="fxb-tab" data-era="new">2026+ · telemetry default</button>' +
    '<button type="button" class="fxb-tab" data-era="sov">2026+ · local trace harness</button>' +
    '</div>';

  const body = h('div', 'fxb-body');
  const svg = s('svg', { class: 'fxb-svg', viewBox: '0 0 680 190', 'aria-hidden': 'true' });

  const pathCode = s('path', { class: 'fxb-route is-code', d: 'M 155 62 C 250 62, 270 48, 360 48' });
  const pathScar = s('path', { class: 'fxb-route is-scar', d: 'M 155 118 C 310 118, 390 135, 515 135' });
  const pathHarness = s('path', { class: 'fxb-route is-local', d: 'M 155 118 C 310 118, 390 135, 515 135' });
  const doorLine = s('line', { class: 'fxb-door', x1: 485, y1: 16, x2: 485, y2: 174 });
  const doorLbl = s('text', { class: 'fxb-door-lbl', x: 485, y: 12, 'text-anchor': 'middle' });
  doorLbl.textContent = 'EXIT DOOR';
  svg.append(pathCode, pathScar, pathHarness, doorLine, doorLbl);

  const cards = h('div', 'fxb-cards');
  cards.innerHTML =
    '<div class="fxb-card is-work">' +
    '<div class="fxb-card__title">5 years on the clock</div>' +
    '<div class="fxb-card__sub">1,200 PRs · 8,000 agent runs</div>' +
    '<div class="fxb-chip is-code">shipped code</div>' +
    '<div class="fxb-chip is-scar">scar tissue &amp; vetoes</div>' +
    '</div>' +
    '<div class="fxb-card is-vault">' +
    '<div class="fxb-card__title">employer retains</div>' +
    '<div class="fxb-card__sub fxb-vault-sub">git repository only</div>' +
    '<div class="fxb-vault-items">' +
    '<span class="fxb-pill">commits &amp; diffs</span>' +
    '<span class="fxb-pill is-stolen">8,000 decision traces</span>' +
    '<span class="fxb-pill is-stolen">preference weights</span>' +
    '</div>' +
    '</div>' +
    '<div class="fxb-card is-you">' +
    '<div class="fxb-card__title">walks out with you</div>' +
    '<div class="fxb-card__sub fxb-you-sub">unformalized intuition in skull</div>' +
    '<div class="fxb-you-items">' +
    '<span class="fxb-pill is-kept">judgment in head</span>' +
    '<span class="fxb-pill is-harness-pill">15 compiled gates + evals</span>' +
    '<span class="fxb-pill is-zero">resume PDF · 0 weights</span>' +
    '</div>' +
    '</div>';

  body.append(svg, cards);
  const foot = h('div', 'fxb-foot');
  stage.append(head, body, foot);
  fig.prepend(stage);

  const tabs = Array.from(head.querySelectorAll<HTMLButtonElement>('.fxb-tab'));
  const vaultSub = cards.querySelector<HTMLElement>('.fxb-vault-sub')!;
  const youSub = cards.querySelector<HTMLElement>('.fxb-you-sub')!;

  const setEra = (era: 'old' | 'new' | 'sov') => {
    stage.dataset.era = era;
    tabs.forEach((t) => t.classList.toggle('is-active', t.dataset.era === era));
    if (era === 'old') {
      pathScar.setAttribute('d', 'M 155 118 C 310 118, 390 135, 515 135');
      vaultSub.textContent = 'git repository only (what shipped)';
      youSub.textContent = 'experience inside your skull';
      foot.innerHTML =
        '<b>1985 – 2024:</b> The company kept the code you typed; you left with the scar tissue because nothing recorded how you arrived at the diff.';
    } else if (era === 'new') {
      pathScar.setAttribute('d', 'M 155 118 C 250 118, 270 84, 360 84');
      vaultSub.textContent = 'git repo + OTel trace collector';
      youSub.textContent = 'stateless memory · zero weights';
      foot.innerHTML =
        '<b>2026 default:</b> Managed OTel &amp; session collectors reroute every veto, edit, and abort into company storage before you ever leave.';
    } else {
      pathScar.setAttribute('d', 'M 155 118 C 250 118, 270 84, 360 84');
      vaultSub.textContent = 'git repo + company logs';
      youSub.textContent = 'portable harness + failure corpus';
      foot.innerHTML =
        '<b>With local trace intelligence:</b> Even if the employer logs the session, your local loop mines every correction into portable gates and evals you carry out the door.';
    }
  };

  tabs.forEach((t) => t.addEventListener('click', () => setEra(t.dataset.era as 'old' | 'new' | 'sov')));
  setEra('new');

  let cycled = false;
  if (!prefersReduced()) {
    watchVisible(
      stage,
      (on) => {
        if (on && !cycled) {
          cycled = true;
          setEra('old');
          setTimeout(() => {
            if (stage.dataset.era === 'old') setEra('new');
          }, 2200);
        }
      },
      0.4,
    );
  }
}
