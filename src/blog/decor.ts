import { decorCanvasKinds } from '../../scripts/blog/decor-canvas-kinds.mjs';
import { initLocalInferenceCanvas } from './decor/localInferenceCanvas';
import { initAskingCanvas } from './decor/askingCanvas';
import { initBoidsCanvas } from './decor/boidsCanvas';

type CanvasRenderer = (canvas: HTMLCanvasElement, seed: string) => void;

const canvasRenderers: Record<string, CanvasRenderer> = {
  'local-inference': initLocalInferenceCanvas,
  'asking': initAskingCanvas,
  'boids': initBoidsCanvas,
};

function initCanvasDecor(canvas: HTMLCanvasElement) {
  const kind = canvas.dataset.decorCanvas;
  const seed = canvas.dataset.decorSeed ?? 'blog-canvas';

  if (!kind) {
    return;
  }

  const init = canvasRenderers[kind];

  if (init) {
    init(canvas, seed);
    return;
  }

  console.warn(
    `[blog-decor] Unknown canvas kind "${kind}". Supported kinds: ${decorCanvasKinds.join(', ')}.`,
  );
}

function boot() {
  document.querySelectorAll<HTMLCanvasElement>('.blog-decor-canvas').forEach((canvas) => {
    initCanvasDecor(canvas);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}