import { h, prefersReduced, s, watchVisible } from './util';

// 4. Six Identical Prompts, Six Divergent Engineers
type Lane = {
  role: string;
  action: string;
  kind: 'accept' | 'reject' | 'edit' | 'stop';
  delta: string;
  outcome: string;
  y: number;
};

const LANES: Lane[] = [
  {
    role: 'Junior SWE',
    action: 'merges agent branch as-is',
    kind: 'accept',
    delta: '0 edits · waves through 14/14 green tests',
    outcome: '400 retry storms auth service in prod',
    y: 26,
  },
  {
    role: 'Backend SWE',
    action: 'patches status check only',
    kind: 'edit',
    delta: 'status >= 500 · misses config/prod.yaml hunk',
    outcome: '300s worker timeout ships uninvited',
    y: 62,
  },
  {
    role: 'SRE / Infra',
    action: 'rewrites backoff + reverts config',
    kind: 'edit',
    delta: 'jittered cap + git checkout config/prod.yaml',
    outcome: 'misses widened 422 test assertion',
    y: 98,
  },
  {
    role: 'Security Eng',
    action: 'blocks auth header leak on retry',
    kind: 'reject',
    delta: 'strips bearer token before cross-host redirect',
    outcome: 'prevents credential leak in retry logs',
    y: 134,
  },
  {
    role: 'Staff SWE (you)',
    action: '5 cuts: 5xx, jitter, revert cfg, fix test, SIGINT',
    kind: 'reject',
    delta: '+5 labeled preference pairs in 10 minutes',
    outcome: 'clean fix + test invariant preserved',
    y: 170,
  },
  {
    role: 'Principal SWE',
    action: 'aborts run · deletes retry loop entirely',
    kind: 'stop',
    delta: 'moves upload to idempotent presigned S3 PUT',
    outcome: 'eliminates server-side upload proxy',
    y: 206,
  },
];

export function initDivergentFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxd');

  const head = h('div', 'fxd-head');
  head.innerHTML =
    '<span class="fxd-head__title">same 6-word prompt · 6 engineers · 6 completely different diffs</span>' +
    '<span class="fxd-head__sub">t=0 prompt is identical noise; t=30m diff is the fingerprint of who sat at the keyboard</span>';

  const wrap = h('div', 'fxd-wrap');
  const svg = s('svg', { class: 'fxd-svg', viewBox: '0 0 680 232', 'aria-hidden': 'true' });

  const pLine = s('line', { class: 'fxd-stem', x1: 24, y1: 116, x2: 190, y2: 116 });
  svg.append(pLine);

  const rowsWrap = h('div', 'fxd-rows');
  const detail = h('div', 'fxd-detail');

  const setActive = (idx: number) => {
    const l = LANES[idx];
    rowsWrap.querySelectorAll('.fxd-row').forEach((r, i) => r.classList.toggle('is-active', i === idx));
    svg.querySelectorAll('.fxd-branch').forEach((b, i) => b.classList.toggle('is-active', i === idx));
    detail.innerHTML =
      `<span class="fxd-detail__role">${l.role}</span>` +
      `<code class="fxd-detail__delta">${l.delta}</code>` +
      `<span class="fxd-detail__out is-${l.kind}">→ ${l.outcome}</span>`;
  };

  LANES.forEach((l, i) => {
    const path = s('path', {
      class: `fxd-branch is-${l.kind}`,
      d: `M 190 116 C 255 116, 265 ${l.y}, 330 ${l.y}`,
    });
    svg.append(path);

    const row = h('button', `fxd-row is-${l.kind}`) as HTMLButtonElement;
    row.type = 'button';
    row.style.top = `${(l.y / 232) * 100}%`;
    row.innerHTML = `<span class="fxd-row__role">${l.role}</span><span class="fxd-row__act">${l.action}</span>`;
    row.addEventListener('mouseenter', () => setActive(i));
    row.addEventListener('click', () => setActive(i));
    rowsWrap.append(row);
  });

  const originBadge = h('div', 'fxd-badge is-prompt');
  originBadge.innerHTML = '<span>t = 00:00</span><b>"add retries to the upload client"</b>';
  const agentBadge = h('div', 'fxd-badge is-agent');
  agentBadge.innerHTML = '<span>t = 20:00</span><b>identical agent patch</b>';

  wrap.append(svg, originBadge, agentBadge, rowsWrap);
  stage.append(head, wrap, detail);
  fig.prepend(stage);
  setActive(4);
}

// 5. The Biological Retry Loop vs Compiled Gate
export function initRetryLoopFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxr');

  const head = h('div', 'fxr-head');
  head.innerHTML =
    '<div class="fxr-head__left">' +
    '<span class="fxr-head__title">the biological retry loop</span>' +
    '<span class="fxr-head__sub">every uncompiled fix evaporates when the window closes</span>' +
    '</div>' +
    '<button type="button" class="fxr-toggle" role="switch" aria-checked="false">' +
    '<span class="fxr-toggle__track"><i></i></span>' +
    '<span class="fxr-toggle__lbl">compile trace into rule</span>' +
    '<b class="fxr-toggle__state">off</b>' +
    '</button>';

  const days = h('div', 'fxr-days');
  const renderDays = (compiled: boolean) => {
    days.innerHTML = '';
    const specs = [
      {
        day: 'Day 1 · Mon',
        mistake: 'agent edits ~/.hermes/config.yaml (wrong file)',
        resp: 'you fix path by hand · close terminal · model memory wiped',
        cost: '14 min lost · 0 rules written',
        blocked: false,
      },
      {
        day: 'Day 2 · Wed',
        mistake: 'fresh session edits ~/.hermes/config.yaml again',
        resp: 'you fix path a 2nd time · sigh · close terminal',
        cost: '12 min lost · 0 rules written',
        blocked: false,
      },
      {
        day: 'Day 3 · Fri',
        mistake: 'fresh session reaches for ~/.hermes/config.yaml',
        resp: compiled
          ? 'GATE FIRED: ~/AGENTS.md redirects agent to ~/.hermes/data/config.yaml in 0ms'
          : 'you fix path a 3rd time · you are now the model’s biological retry loop',
        cost: compiled ? '0 min human time · bug class extinct' : '15 min lost · 41 min cumulative tax',
        blocked: compiled,
      },
      {
        day: 'Day 4 … Day 100',
        mistake: 'every future session across all 4 machines',
        resp: compiled
          ? 'mounts /opt/data/config.yaml automatically · human never paged'
          : 'repeats every week forever whenever context resets',
        cost: compiled ? '96 future interventions prevented' : 'unpaid retry loop continues',
        blocked: compiled,
      },
    ];

    specs.forEach((sp) => {
      const card = h('div', `fxr-day ${sp.blocked ? 'is-compiled' : 'is-loop'}`);
      card.innerHTML =
        `<div class="fxr-day__top"><span class="fxr-day__name">${sp.day}</span><b class="fxr-day__tag">${sp.blocked ? '✓ gate active' : '↻ manual retry'}</b></div>` +
        `<div class="fxr-day__err">${sp.mistake}</div>` +
        `<div class="fxr-day__resp">${sp.resp}</div>` +
        `<div class="fxr-day__cost">${sp.cost}</div>`;
      days.append(card);
    });
  };

  stage.append(head, days);
  fig.prepend(stage);

  let compiled = false;
  let touched = false;
  const btn = head.querySelector<HTMLButtonElement>('.fxr-toggle')!;
  const stateEl = head.querySelector<HTMLElement>('.fxr-toggle__state')!;

  const setCompiled = (on: boolean) => {
    compiled = on;
    stage.classList.toggle('is-compiled', on);
    btn.setAttribute('aria-checked', String(on));
    stateEl.textContent = on ? 'on' : 'off';
    renderDays(on);
  };

  btn.addEventListener('click', () => {
    touched = true;
    setCompiled(!compiled);
  });

  setCompiled(false);

  if (!prefersReduced()) {
    watchVisible(
      stage,
      (on) => {
        if (on && !touched && !compiled) {
          setTimeout(() => {
            if (!touched) setCompiled(true);
          }, 3200);
        }
      },
      0.4,
    );
  }
}
