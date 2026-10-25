import { h } from './util';

// 10. The Harness Interview Sandbox (Playable 3-Candidate Swarm Gate)
type Attempt = {
  agent: string;
  patch: string;
  hazard: string;
  gateLevel: 1 | 2 | 3;
  gateName: string;
};

const ATTEMPTS: Attempt[] = [
  {
    agent: 'agent-01',
    patch: 'retries upload on HTTP 400 + bumps prod timeout to 300s',
    hazard: 'auth service DoS + trajectory residue',
    gateLevel: 1,
    gateName: 'no-4xx-retry + diff-vs-base-clean',
  },
  {
    agent: 'agent-02',
    patch: 'adds migration 0042_idx.py branching off stale parent 0039',
    hazard: 'forked Alembic head breaks prod deploy',
    gateLevel: 1,
    gateName: 'alembic-heads-linear',
  },
  {
    agent: 'agent-03',
    patch: 'changes assert status == 422 to assert status in (200, 422)',
    hazard: 'test assertion weakened to turn CI green',
    gateLevel: 2,
    gateName: 'no-test-tampering',
  },
  {
    agent: 'agent-04',
    patch: 'catches ProxyTimeout and falls back to direct unproxied request',
    hazard: 'silent egress policy bypass on timeout',
    gateLevel: 3,
    gateName: 'no-fail-open-fallback',
  },
  {
    agent: 'agent-05',
    patch: 'idempotent presigned S3 upload with jittered 5xx backoff + fail-before test',
    hazard: 'clean fix · verified on live surface',
    gateLevel: 99 as 3,
    gateName: 'all gates passed → MERGE',
  },
];

export function initSandboxFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxsb');

  const head = h('div', 'fxsb-head');
  head.innerHTML =
    '<span class="fxsb-head__title">the principal interview · mount candidate harness onto a 5-agent swarm</span>' +
    '<div class="fxsb-tabs">' +
    '<button type="button" class="fxsb-tab" data-lvl="0">Candidate A · Resume PDF only (0 gates)</button>' +
    '<button type="button" class="fxsb-tab" data-lvl="1">Candidate B · Basic linter (4 gates)</button>' +
    '<button type="button" class="fxsb-tab is-active" data-lvl="3">Candidate C · Principal harness (15 gates)</button>' +
    '</div>';

  const list = h('div', 'fxsb-list');
  const summary = h('div', 'fxsb-summary');
  stage.append(head, list, summary);
  fig.prepend(stage);

  const tabs = Array.from(head.querySelectorAll<HTMLButtonElement>('.fxsb-tab'));

  const runSandbox = (lvl: number) => {
    tabs.forEach((t) => t.classList.toggle('is-active', Number(t.dataset.lvl) === lvl));
    list.innerHTML = '';
    let bugsShipped = 0;
    let blockedCount = 0;

    ATTEMPTS.forEach((a) => {
      const isClean = a.gateLevel > 10;
      const blocked = !isClean && lvl >= a.gateLevel;
      if (!isClean && !blocked) bugsShipped++;
      if (blocked) blockedCount++;

      const row = h('div', `fxsb-row ${isClean ? 'is-clean' : blocked ? 'is-blocked' : 'is-leaked'}`);
      row.innerHTML =
        `<code class="fxsb-row__agent">${a.agent}</code>` +
        `<div class="fxsb-row__main"><div class="fxsb-row__patch">${a.patch}</div><div class="fxsb-row__haz">${a.hazard}</div></div>` +
        `<span class="fxsb-row__verdict">${
          isClean
            ? '✓ SHIPPED CLEAN'
            : blocked
              ? `✕ BLOCKED (${a.gateName})`
              : '⚠ MERGED TO MAIN (incident)'
        }</span>`;
      list.append(row);
    });

    summary.className = `fxsb-summary ${bugsShipped === 0 ? 'is-pass' : 'is-fail'}`;
    summary.innerHTML =
      bugsShipped === 0
        ? `<b>Hire verdict · PASS:</b> Harness blocked all ${blockedCount} agent traps automatically and merged 1 verified fix.`
        : `<b>Hire verdict · FAIL:</b> ${bugsShipped} production-breaking agent patches slipped onto <code>main</code> (${blockedCount} blocked).`;
  };

  tabs.forEach((t) => t.addEventListener('click', () => runSandbox(Number(t.dataset.lvl))));
  runSandbox(3);
}

// 11. Multi-Machine Tailscale Trace Topology
type HostSpec = {
  id: string;
  name: string;
  sub: string;
  sessions: string;
  symptom: string;
  rule: string;
};

const HOSTS: HostSpec[] = [
  {
    id: 'mac',
    name: 'mac · controller',
    sub: 'Claude Code · Cursor · tracequest hub',
    sessions: '3,390 sessions',
    symptom: '3,119 repeated gh pr checks polls across 184h',
    rule: 'compiled → single blocking gh pr checks --watch',
  },
  {
    id: 'fedora',
    name: 'fedora · Strix Halo',
    sub: 'Kandev · Codex · Hermes gateway',
    sessions: '8,245 sessions',
    symptom: 'agents edit ~/.hermes/config.yaml decoy on host',
    rule: 'compiled → ~/AGENTS.md container mount path rule',
  },
  {
    id: 'hetzner',
    name: 'hetzner · devbox',
    sub: 'Grok · Codex · 1,469 Zeta runs',
    sessions: '2,332 sessions',
    symptom: 'parallel subagents fork Alembic migration heads',
    rule: 'compiled → pre-merge alembic heads linearity gate',
  },
  {
    id: 'av',
    name: 'sandbox-av · worker',
    sub: 'Droid · Claude · prod watch',
    sessions: '329 sessions',
    symptom: 'wrong cwd / missing env treated as logic bug',
    rule: 'compiled → env-before-code preflight check',
  },
];

export function initTopologyFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxtp');

  const head = h('div', 'fxtp-head');
  head.innerHTML =
    '<span class="fxtp-head__title">tailnet trace topology · 4 machines → tracequest → 1 synced skill repo</span>' +
    '<span class="fxtp-head__sub">click a host to see how raw JSONL failures become fleet-wide rules in 60 seconds</span>';

  const grid = h('div', 'fxtp-grid');
  const hostsCol = h('div', 'fxtp-hosts');
  const hubCol = h('div', 'fxtp-hub');
  hubCol.innerHTML =
    '<div class="fxtp-hub__box">' +
    '<div class="fxtp-hub__title">tracequest index</div>' +
    '<div class="fxtp-hub__sub">14,296 sessions · JSONL search &amp; replay</div>' +
    '<div class="fxtp-hub__arrow">↓ cluster &amp; compile ↓</div>' +
    '<div class="fxtp-hub__sync"><code>fleet skills sync</code> → all 4 hosts</div>' +
    '</div>' +
    '<div class="fxtp-detail"></div>';

  const detail = hubCol.querySelector<HTMLElement>('.fxtp-detail')!;
  const btns: HTMLButtonElement[] = [];

  const select = (idx: number) => {
    const hs = HOSTS[idx];
    btns.forEach((b, i) => b.classList.toggle('is-active', i === idx));
    detail.innerHTML =
      `<div class="fxtp-detail__host"><span>selected node</span><b>${hs.name}</b> · ${hs.sessions}</div>` +
      `<div class="fxtp-detail__row is-err"><span>mined trace pattern</span><code>${hs.symptom}</code></div>` +
      `<div class="fxtp-detail__row is-fix"><span>synced rule</span><code>${hs.rule}</code></div>`;
  };

  HOSTS.forEach((hs, i) => {
    const b = h('button', 'fxtp-host') as HTMLButtonElement;
    b.type = 'button';
    b.innerHTML =
      `<div class="fxtp-host__top"><b>${hs.name}</b><span>${hs.sessions}</span></div>` +
      `<div class="fxtp-host__sub">${hs.sub}</div>`;
    b.addEventListener('click', () => select(i));
    b.addEventListener('mouseenter', () => select(i));
    btns.push(b);
    hostsCol.append(b);
  });

  grid.append(hostsCol, hubCol);
  stage.append(head, grid);
  fig.prepend(stage);
  select(1);
}

// 13. Anatomy of a Compiled Veto (3-Stage Compiler Pipeline)
type VetoCase = {
  name: string;
  raw: string;
  invariant: string;
  compiled: string;
  saved: string;
};

const VETO_CASES: VetoCase[] = [
  {
    name: 'Hermes decoy config',
    raw: `session_81a.jsonl: Edit("~/.hermes/config.yaml")\nsession_94c.jsonl: Edit("~/.hermes/config.yaml")\nsession_b02.jsonl: user "wrong file, container mounts ~/.hermes/data/config.yaml"`,
    invariant: 'Host file ~/.hermes/config.yaml is ignored by harbor.hermes container; /opt/data/config.yaml is mounted from ~/.hermes/data/config.yaml.',
    compiled: `# ~/AGENTS.md\nThe config harbor.hermes uses is /home/everlier/.hermes/data/config.yaml.\n~/.hermes/config.yaml is NOT used by the container.`,
    saved: '0 wrong-path edits across 400+ subsequent runs',
  },
  {
    name: 'Alembic branched heads',
    raw: `session_12f.jsonl: alembic revision -m "add_idx" (parent: 91a4)\nsession_44d.jsonl: alembic revision -m "add_col" (parent: 91a4)\nuser: "two heads on main, deploy broken"`,
    invariant: 'Parallel agent worktrees branching off the same commit create divergent Alembic heads unless checked before merge.',
    compiled: `# pre-merge gate\ntest "$(alembic heads | wc -l)" -eq 1 || {\n  echo "FAIL: multiple alembic heads"; exit 1;\n}`,
    saved: '100% of forked migration graphs blocked pre-merge',
  },
  {
    name: 'CI sleep-polling loop',
    raw: `turn 14: bash("sleep 30 && gh pr checks 33")\nturn 15: bash("sleep 30 && gh pr checks 33")\n... 7,951 polls across 540 sessions (184.6h)`,
    invariant: 'Repeated model turns polling gh pr checks burn context and quota; one blocking watch call wakes the harness on exit.',
    compiled: `# workflow-prompt.md\nWait for CI with one blocking call per pushed head:\ngh pr checks <n> --watch --fail-fast\nNever run a polling loop.`,
    saved: '7,951 wasted polling turns eliminated',
  },
  {
    name: 'Trajectory residue hunks',
    raw: `diff --git a/config/prod.yaml b/config/prod.yaml\n- timeout: 30\n+ timeout: 300 # leftover from aborted debug attempt`,
    invariant: '18–33% of agent diff bloat is speculative edits from abandoned hypotheses left in the working tree.',
    compiled: `# pre-DONE gate\ngit diff origin/master...HEAD\n# Revert every hunk the final fix does not need\n# List files changed + reverted hunks in report.`,
    saved: 'stray debugging hunks stripped before review',
  },
];

export function initAnatomyFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxan');

  const head = h('div', 'fxan-head');
  head.innerHTML =
    '<span class="fxan-head__title">anatomy of a compiled veto · from raw JSONL scar to automated gate</span>' +
    '<div class="fxan-tabs"></div>';

  const tabsWrap = head.querySelector<HTMLElement>('.fxan-tabs')!;
  const pipe = h('div', 'fxan-pipe');
  const foot = h('div', 'fxan-foot');
  stage.append(head, pipe, foot);
  fig.prepend(stage);

  const btns: HTMLButtonElement[] = [];
  const select = (idx: number) => {
    const c = VETO_CASES[idx];
    btns.forEach((b, i) => b.classList.toggle('is-active', i === idx));
    pipe.innerHTML =
      '<div class="fxan-stage is-raw">' +
      '<div class="fxan-stage__hdr"><span>stage 1 · raw trace cluster</span><b>3+ repeated interventions</b></div>' +
      `<pre class="fxan-stage__code">${c.raw}</pre>` +
      '</div>' +
      '<div class="fxan-stage is-inv">' +
      '<div class="fxan-stage__hdr"><span>stage 2 · extracted invariant</span><b>root cause</b></div>' +
      `<div class="fxan-stage__text">${c.invariant}</div>` +
      '</div>' +
      '<div class="fxan-stage is-gate">' +
      '<div class="fxan-stage__hdr"><span>stage 3 · compiled artifact</span><b>rule / check</b></div>' +
      `<pre class="fxan-stage__code">${c.compiled}</pre>` +
      '</div>';
    foot.innerHTML = `<b>Measured payoff:</b> ${c.saved}.`;
  };

  VETO_CASES.forEach((c, i) => {
    const b = h('button', 'fxan-tab', c.name) as HTMLButtonElement;
    b.type = 'button';
    b.addEventListener('click', () => select(i));
    btns.push(b);
    tabsWrap.append(b);
  });

  select(0);
}

// 14. The Vanity Pareto Curve (15 heuristics = 90% of "senior intuition")
const PARETO_ITEMS: [string, number][] = [
  ['env / cwd before code', 142],
  ['no CI sleep-polling loops', 118],
  ['strip trajectory residue', 96],
  ['no test/assertion tampering', 84],
  ['verify live surface (no proxy-done)', 76],
  ['alembic head linearity', 64],
  ['retry 5xx only + jitter', 58],
  ['wrong config / container path', 52],
  ['no lockfile churn', 46],
  ['no fail-open security fallback', 42],
  ['bounded host load / -n 2 workers', 34],
  ['$100 metered spend gate', 28],
  ['no silent catch blocks', 24],
  ['no secrets in logs / args', 20],
  ['rollback path on migrations', 16],
];

export function initParetoFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxpr');

  const head = h('div', 'fxpr-head');
  head.innerHTML =
    '<div class="fxpr-head__left">' +
    '<span class="fxpr-head__title">the vanity pareto · 1,000 interventions ranked by frequency</span>' +
    '<span class="fxpr-head__sub">900 mechanical vetoes (15 rules) vs 100 bespoke architectural calls</span>' +
    '</div>' +
    '<button type="button" class="fxpr-btn">compile top 15 rules out of your head</button>';

  const bars = h('div', 'fxpr-bars');
  const rows: HTMLElement[] = [];

  PARETO_ITEMS.forEach(([lbl, count], i) => {
    const row = h('div', 'fxpr-row');
    const pct = (count / 150) * 100;
    row.innerHTML =
      `<span class="fxpr-row__idx">#${String(i + 1).padStart(2, '0')}</span>` +
      `<span class="fxpr-row__lbl">${lbl}</span>` +
      `<i class="fxpr-row__bar"><u style="width:${pct.toFixed(1)}%"></u></i>` +
      `<b class="fxpr-row__cnt">${count}</b>`;
    rows.push(row);
    bars.append(row);
  });

  const rareRow = h('div', 'fxpr-row is-rare');
  rareRow.innerHTML =
    '<span class="fxpr-row__idx">★</span>' +
    '<span class="fxpr-row__lbl">unformalizable taste (domain tradeoffs, business risk, novel architecture)</span>' +
    '<i class="fxpr-row__bar"><u style="width:66.7%"></u></i>' +
    '<b class="fxpr-row__cnt">100 (10%)</b>';
  bars.append(rareRow);

  const foot = h('div', 'fxpr-foot');
  stage.append(head, bars, foot);
  fig.prepend(stage);

  let compiled = false;
  const btn = head.querySelector<HTMLButtonElement>('.fxpr-btn')!;

  const update = (on: boolean) => {
    compiled = on;
    stage.classList.toggle('is-compiled', on);
    btn.textContent = on ? 'show uncompiled 1,000-run log' : 'compile top 15 rules out of your head';
    foot.innerHTML = on
      ? '<b>After 15 afternoons of compilation:</b> 900 repetitive vetoes vanish into scripts. The remaining <b>10%</b> is the only part of your judgment that actually needed a human.'
      : '<b>Before compilation:</b> You spend 90% of your review bandwidth repeating 15 predictable vetoes and calling it "senior intuition."';
  };

  btn.addEventListener('click', () => update(!compiled));
  update(false);
}
