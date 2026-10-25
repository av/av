import { h, prefersReduced, scrollProgress, watchVisible } from './util';

// Fig. 4: the entropy ladder. Each week of scrolling compiles the lowest
// manual review into a check, the boundary of "you" climbs a rung, and the
// top rungs stay human because nobody has written them down yet.

type Rung = { human: string; check?: string };

const RUNGS: Rung[] = [
  { human: 'lockfiles left alone', check: 'no-lockfile-churn' },
  { human: 'retry only on server errors', check: 'retry-5xx-only' },
  { human: 'friction is environmental first', check: 'env-before-code' },
  { human: 'migration heads stay linear', check: 'alembic-heads-linear' },
  { human: 'full diff read before done', check: 'diff-vs-base-reviewed' },
  { human: 'when a clean patch is wrong for the business' },
  { human: 'which operational risk is worth taking' },
  { human: 'which project deserves doing at all' },
];

const WEEKS = RUNGS.filter((r) => r.check).length;

export function initLadderFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxl');
  const head = h('div', 'fxl-head');
  const week = h('span', 'fxl-week', 'week 0');
  const legend = h('span', 'fxl-legend');
  legend.append(h('i', 'fxl-legend__line'), 'boundary of “you” · ', week);
  head.append(h('span', 'fxl-head__label', 'entropy ↑'), legend);
  const ladder = h('ol', 'fxl-ladder');
  const rows: HTMLElement[] = [];

  RUNGS.forEach((r, i) => {
    const li = h('li', `fxl-rung${r.check ? '' : ' is-open'}`);
    li.style.setProperty('--i', String(i));
    const label = h('span', 'fxl-rung__label');
    label.append(h('span', 'fxl-rung__human', r.human));
    if (r.check) label.append(h('code', 'fxl-rung__check', r.check));
    const badge = h('span', 'fxl-rung__badge', r.check ? 'you' : 'not formalized');
    li.append(label, badge);
    rows.push(li);
  });
  [...rows].reverse().forEach((li) => ladder.append(li));

  const boundary = h('div', 'fxl-boundary');
  const climber = h('div', 'fxl-you', '▶');
  ladder.append(boundary, climber);
  stage.append(head, ladder);
  fig.prepend(stage);

  let current = -1;

  const apply = (w: number) => {
    if (w === current) return;
    current = w;
    week.textContent = `week ${w}`;
    rows.forEach((li, i) => {
      const done = i < w;
      li.classList.toggle('is-check', done);
      const badge = li.querySelector('.fxl-rung__badge')!;
      if (RUNGS[i].check) badge.textContent = done ? '✓ check' : 'you';
    });
    const rung = rows[Math.min(w, rows.length - 1)];
    const top = rung.offsetTop + rung.offsetHeight;
    boundary.style.transform = `translateY(${top}px)`;
    climber.style.transform = `translate(${rung.offsetLeft - 16}px, ${rung.offsetTop + rung.offsetHeight / 2}px)`;
  };

  const update = () => apply(Math.round(scrollProgress(stage, 0.85, 0.25) * WEEKS));

  const relayout = () => {
    const w = current < 0 ? 0 : current;
    current = -1;
    apply(w);
  };
  new ResizeObserver(relayout).observe(stage);

  if (prefersReduced()) {
    apply(WEEKS);
    return;
  }
  apply(0);
  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      update();
    });
  };
  watchVisible(
    stage,
    (on) => {
      if (on) {
        window.addEventListener('scroll', onScroll, { passive: true });
        update();
      } else {
        window.removeEventListener('scroll', onScroll);
      }
    },
    0,
  );
}
