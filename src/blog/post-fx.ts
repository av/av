import { initInlineFx } from './fx/inlineFx';
import { initCutFigure } from './fx/figures/cutFigure';
import { initFlowFigure } from './fx/figures/flowFigure';
import { initClusterFigure } from './fx/figures/clusterFigure';
import { initLadderFigure } from './fx/figures/ladderFigure';

// Inline effects (`<span data-fx>`) and scripted figures
// (`<figure class="fx-figure" data-figure>`) for blog posts.

const figures: Record<string, (fig: HTMLElement) => void> = {
  cut: initCutFigure,
  flow: initFlowFigure,
  clusters: initClusterFigure,
  ladder: initLadderFigure,
};

function boot() {
  document.querySelectorAll<HTMLElement>('.fx-figure[data-figure]').forEach((fig) => {
    const init = figures[fig.dataset.figure ?? ''];
    if (!init) {
      console.warn(`[post-fx] Unknown figure "${fig.dataset.figure}". Supported: ${Object.keys(figures).join(', ')}.`);
      return;
    }
    fig.classList.add('is-live');
    init(fig);
  });
  initInlineFx();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
