import { initInlineFx } from './fx/inlineFx';
import { initCutFigure } from './fx/figures/cutFigure';
import { initFlowFigure } from './fx/figures/flowFigure';
import { initClusterFigure } from './fx/figures/clusterFigure';
import { initLadderFigure } from './fx/figures/ladderFigure';
import { initArbitrageFigure, initBargainFigure } from './fx/figures/introFigures';
import { initDivergentFigure, initRetryLoopFigure } from './fx/figures/signalFigures';
import { initXrayFigure, initHillclimbFigure, initCompoundingFigure } from './fx/figures/tapeFigures';
import { initSandboxFigure, initTopologyFigure, initAnatomyFigure, initParetoFigure } from './fx/figures/harnessFigures';
import { initRecorderFigure, initFatigueDiffFigure, initSurfaceFigure } from './fx/figures/driftFigures';
import { initCloneFigure, initPhaseSpaceFigure } from './fx/figures/privacyFigures';

// Inline effects (`<span data-fx>`) and scripted figures
// (`<figure class="fx-figure" data-figure>`) for blog posts.

const figures: Record<string, (fig: HTMLElement) => void> = {
  arbitrage: initArbitrageFigure,
  bargain: initBargainFigure,
  cut: initCutFigure,
  divergent: initDivergentFigure,
  'retry-loop': initRetryLoopFigure,
  xray: initXrayFigure,
  flow: initFlowFigure,
  hillclimb: initHillclimbFigure,
  compounding: initCompoundingFigure,
  sandbox: initSandboxFigure,
  topology: initTopologyFigure,
  clusters: initClusterFigure,
  anatomy: initAnatomyFigure,
  pareto: initParetoFigure,
  recorder: initRecorderFigure,
  'fatigue-diff': initFatigueDiffFigure,
  surface: initSurfaceFigure,
  ladder: initLadderFigure,
  clone: initCloneFigure,
  'phase-space': initPhaseSpaceFigure,
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
