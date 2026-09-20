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

function boot() {
  document.querySelectorAll<HTMLElement>('.graph-story[data-graph]').forEach(mount);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
