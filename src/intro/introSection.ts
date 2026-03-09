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
  // Exponential-decay LERP (damping=1): no velocity, no oscillation.
  // elasticity=0.06 → ~4% of remaining distance closed per frame at 60fps,
  // giving a slow, fluid glide that never overshoots.
  const mousePosition = new InterpolatedValue([0, 0], 0.01);

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
    // Clamp dt to avoid huge jumps after tab suspension (max ~4 frames)
    const dt = Math.min(elapsed / TARGET_FRAME_MS, 4);

    mousePosition.tick(dt);

    const containerRect = container.getBoundingClientRect();
    const cx = containerRect.left + containerRect.width  / 2;
    const cy = containerRect.top  + containerRect.height / 2;

    // Mouse offset: centred at 0, normalised to container half-size,
    // so moving edge-to-edge produces roughly -1 → +1.
    const mouseOffset = [
      (mousePosition.value[0] - cx) / containerRect.width,
      (mousePosition.value[1] - cy) / containerRect.height,
    ];

    // Scroll offset derived from containerRect.top — correct regardless
    // of which element is the scroll container (avoids window.scrollY
    // returning 0 when overflow-x:hidden is set on <html>).
    const scrollOffset = -containerRect.top / containerRect.height;

    // Scale factor converts normalised offsets → px.
    // Using container width for both axes keeps X and Y movement
    // visually consistent regardless of aspect ratio.
    const scale = containerRect.width;

    const scrollMultiplier = window.innerHeight > window.innerWidth ? 5 : 1;

    for (const decoration of decorations) {
      // force is 10–130; divide by 1000 to get a gentle 1–13% of
      // container width as the max displacement per unit offset.
      const force = parseInt(decoration.dataset.force) / 1000;
      const tx = mouseOffset[0] * force * scale;
      const ty = mouseOffset[1] * force * scale + scrollOffset * force * scale * scrollMultiplier;
      decoration.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`;
    }

    window.requestAnimationFrame(update);
  }
}
