import { qs, qsa, scrollTo } from '../utils';
import InterpolatedValue from '../lib/InterpolatedValue';

export const selectors = {
  container: 'section.intro',
  decorations: 'section.intro .decorations-layer .decoration',
  pills: 'section.intro .pill[data-target]',
};

export function init(selectors) {
  const container = qs(selectors.container);
  const decorations = qsa(selectors.decorations);
  const pills = qsa(selectors.pills);

  // Mouse: very slow, dreamy glide
  const mousePosition = new InterpolatedValue([0, 0], 0.01);
  // Scroll: snappier — reacts faster but still smoothed
  const scrollPosition = new InterpolatedValue([0], 0.08);

  window.addEventListener('pointermove', (e: MouseEvent) => {
    mousePosition.setValue([e.clientX, e.clientY]);
  });

  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      scrollTo(pill.dataset.target);
    });
  });

  const TARGET_FRAME_MS = 1000 / 60;
  let lastTimestamp: number | null = null;

  update(performance.now());

  function update(timestamp: number) {
    const elapsed = lastTimestamp !== null ? timestamp - lastTimestamp : TARGET_FRAME_MS;
    lastTimestamp = timestamp;
    const dt = Math.min(elapsed / TARGET_FRAME_MS, 4);

    mousePosition.tick(dt);

    const containerRect = container.getBoundingClientRect();

    // Feed scroll from containerRect.top — works regardless of which
    // element is the scroll container (safe with overflow-x:hidden on html).
    scrollPosition.setValue([-containerRect.top]);
    scrollPosition.tick(dt);

    const cx = containerRect.left + containerRect.width  / 2;
    const cy = containerRect.top  + containerRect.height / 2;

    const mouseOffset = [
      (mousePosition.value[0] - cx) / containerRect.width,
      (mousePosition.value[1] - cy) / containerRect.height,
    ];

    const scrollOffset = scrollPosition.value[0] / containerRect.height;

    const scale = containerRect.width;
    const isPortrait = window.innerHeight > window.innerWidth;
    const scrollMultiplier = isPortrait ? 0.3 : 0.02;

    for (const decoration of decorations) {
      const force = parseInt(decoration.dataset.force) / 1000;
      const tx = mouseOffset[0] * force * scale;
      const ty = mouseOffset[1] * force * scale + scrollOffset * force * scale * scrollMultiplier;
      decoration.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`;
    }

    window.requestAnimationFrame(update);
  }
}
