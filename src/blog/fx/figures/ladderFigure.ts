import { h, prefersReduced, scrollProgress, watchVisible } from './util';

// Fig. 18 (ladder): The entropy ladder. Scroll compiles lower rungs into green
// checks and pushes the red boundary of "you" upward.
const RUNG_COUNT = 8;
const CHECK_COUNT = 5;

export function initLadderFigure(fig: HTMLElement): void {
  const stage = h('div', 'fx-figure__stage fxl');
  const head = h('div', 'fxl-head');
  const legend = h('span', 'fxl-legend');
  legend.append(h('i', 'fxl-legend__line'), 'you');
  head.append(h('span', 'fxl-head__label', 'entropy ↑'), legend);

  const ladder = h('ol', 'fxl-ladder');
  const rows: HTMLElement[] = [];

  for (let i = 0; i < RUNG_COUNT; i++) {
    const canCheck = i < CHECK_COUNT;
    const li = h('li', `fxl-rung${canCheck ? '' : ' is-open'}`);
    li.style.setProperty('--i', String(i));
    const bar = h('span', 'fxl-rung__bar');
    const badge = h('span', 'fxl-rung__badge', canCheck ? '·' : '?');
    li.append(bar, badge);
    rows.push(li);
  }
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
    rows.forEach((li, i) => {
      const done = i < w;
      li.classList.toggle('is-check', done);
      if (i < CHECK_COUNT) {
        li.querySelector('.fxl-rung__badge')!.textContent = done ? '✓' : '·';
      }
    });
    const rung = rows[Math.min(w, rows.length - 1)];
    const top = rung.offsetTop + rung.offsetHeight;
    boundary.style.transform = `translateY(${top}px)`;
    climber.style.transform = `translate(${rung.offsetLeft - 16}px, ${rung.offsetTop + rung.offsetHeight / 2}px)`;
  };

  const update = () => apply(Math.round(scrollProgress(stage, 0.85, 0.25) * CHECK_COUNT));

  const relayout = () => {
    const w = current < 0 ? 0 : current;
    current = -1;
    apply(w);
  };
  new ResizeObserver(relayout).observe(stage);

  if (prefersReduced()) {
    apply(CHECK_COUNT);
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
