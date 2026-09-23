import { initGrainClipping } from '../grain-clipping';
import { GraphStory } from '../lib/graph';
import type { GraphStorySpec, StoryTrigger } from '../lib/graph';

const TRIGGERS = new Set<StoryTrigger>(['scroll', 'click', 'timeline']);

function readSpec(container: HTMLElement): GraphStorySpec | null {
  const script = container.querySelector<HTMLScriptElement>('script[data-graph-story]');
  if (!script?.textContent) return null;

  const parsed: unknown = JSON.parse(script.textContent);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as GraphStorySpec).steps)) {
    throw new Error(`[graph-story] "${container.dataset.graph}" is not a story spec`);
  }
  return parsed as GraphStorySpec;
}

function mount(container: HTMLElement): void {
  const spec = readSpec(container);
  if (!spec) return;

  const trigger = container.dataset.trigger;
  new GraphStory(container, spec, {
    trigger: trigger && TRIGGERS.has(trigger as StoryTrigger) ? (trigger as StoryTrigger) : undefined,
  }).init();
}

async function boot() {
  // Cards are sized from measured text, so the pixel font has to be loaded
  // before the first layout or every card comes out the wrong width.
  try {
    await document.fonts?.ready;
  } catch {
    // Font loading is a progressive enhancement; fall back to whatever is ready.
  }
  document.querySelectorAll<HTMLElement>('.graph-story[data-graph]').forEach(mount);
  // After mounting: the stories now have their final size.
  initGrainClipping();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void boot(), { once: true });
} else {
  void boot();
}
