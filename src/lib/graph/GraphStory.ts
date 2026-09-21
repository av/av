import GraphLayout from './layout';
import type { Layout } from './layout';
import GraphRenderer from './renderer';
import { resolveStory } from './story';
import type { GraphStorySpec, ResolvedStep, StoryTrigger } from './types';

interface GraphStoryOptions {
  /** Overrides `spec.trigger`. */
  trigger?: StoryTrigger;
  /** Base transition length in ms; 0 disables animation. */
  duration?: number;
  /** Called after every step change. */
  onStep?: (index: number, step: ResolvedStep) => void;
}

const DEFAULT_DURATION = 900;
const DEFAULT_INTERVAL = 2600;
const SCROLL_STEP_HEIGHT_VH = 65;

/**
 * Mounts an animated graph story into a container element.
 *
 * The container is emptied and replaced with a stage, caption and controls.
 * Steps are pre-resolved and laid out on demand; layouts are cached so going
 * back and forth replays the same geometry.
 */
export default class GraphStory {
  static selectors = {
    root: 'graph-story',
  };

  readonly steps: ResolvedStep[];
  readonly trigger: StoryTrigger;

  private readonly container: HTMLElement;
  private readonly spec: GraphStorySpec;
  private readonly options: GraphStoryOptions;
  private readonly layout: GraphLayout;
  private readonly layouts: Layout[] = [];
  private renderer: GraphRenderer | null = null;
  private index = -1;
  private reduceMotion = false;

  private figure!: HTMLElement;
  private panels: HTMLElement[] = [];
  private title!: HTMLElement;
  private caption!: HTMLElement;
  private counter!: HTMLElement;
  private dots: HTMLButtonElement[] = [];
  private prevButton!: HTMLButtonElement;
  private nextButton!: HTMLButtonElement;
  private playButton: HTMLButtonElement | null = null;

  private timer: number | null = null;
  private playing = false;
  private scrollFrame: number | null = null;
  private readonly cleanups: (() => void)[] = [];

  constructor(container: HTMLElement, spec: GraphStorySpec, options: GraphStoryOptions = {}) {
    this.container = container;
    this.spec = spec;
    this.options = options;
    this.steps = resolveStory(spec);
    this.trigger = options.trigger ?? spec.trigger ?? 'click';
    this.layout = new GraphLayout(spec.aspect ?? 1.6, spec.seed ?? 'graph-story');
  }

  get current(): number {
    return this.index;
  }

  init(): this {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reduceMotion = motionQuery.matches;
    const onMotionChange = () => {
      this.reduceMotion = motionQuery.matches;
      if (this.reduceMotion) this.pause();
    };
    motionQuery.addEventListener('change', onMotionChange);
    this.cleanups.push(() => motionQuery.removeEventListener('change', onMotionChange));

    this.buildDom();
    this.bindControls();

    if (this.trigger === 'scroll') {
      this.bindScroll();
    } else {
      this.goTo(0, true);
    }

    if (this.trigger === 'timeline') {
      this.bindAutoplay();
    }

    this.warmLayouts();
    return this;
  }

  /** Computes the remaining layouts in idle time so jumping ahead never stalls the main thread. */
  private warmLayouts(): void {
    const schedule = (fn: () => void): void => {
      if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(fn);
      else window.setTimeout(fn, 32);
    };
    const step = () => {
      if (this.layouts.length >= this.steps.length) return;
      this.layouts.push(this.layout.compute(this.steps[this.layouts.length].state));
      schedule(step);
    };
    schedule(step);
  }

  destroy(): void {
    this.pause();
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.container.replaceChildren();
    this.container.classList.remove('is-ready');
  }

  next(): void {
    this.goTo(Math.min(this.steps.length - 1, this.index + 1));
  }

  prev(): void {
    this.goTo(Math.max(0, this.index - 1));
  }

  goTo(index: number, immediate = false): void {
    if (index === this.index || index < 0 || index >= this.steps.length) return;

    if (this.trigger === 'scroll' && !immediate) {
      this.scrollToStep(index);
      return;
    }

    this.applyStep(index, immediate);
  }

  play(): void {
    if (this.playing) return;
    this.playing = true;
    this.playButton?.classList.add('is-playing');
    this.playButton?.setAttribute('aria-label', 'Pause');
    this.tickAutoplay();
  }

  pause(): void {
    this.playing = false;
    this.playButton?.classList.remove('is-playing');
    this.playButton?.setAttribute('aria-label', 'Play');
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private applyStep(index: number, immediate: boolean): void {
    const jump = Math.abs(index - this.index) > 1 || this.index === -1;
    this.index = index;

    // Cached layouts keep going back deterministic; compute forward on demand.
    while (this.layouts.length <= index) {
      this.layouts.push(this.layout.compute(this.steps[this.layouts.length].state));
    }

    const duration = immediate || this.reduceMotion ? 0 : (this.options.duration ?? DEFAULT_DURATION) * (jump ? 0.6 : 1);
    this.renderer?.render(this.layouts[index], duration);
    this.updateChrome();
    this.options.onStep?.(index, this.steps[index]);
  }

  private buildDom(): void {
    const { container } = this;
    container.replaceChildren();
    container.classList.add(GraphStory.selectors.root, `is-trigger-${this.trigger}`, 'is-ready');
    container.style.setProperty('--gs-steps', String(this.steps.length));
    container.style.setProperty('--gs-step-height', `${SCROLL_STEP_HEIGHT_VH}vh`);

    this.figure = el('figure', 'graph-story__figure');
    const stage = el('div', 'graph-story__stage');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'graph-story__svg');
    svg.setAttribute('role', 'img');
    stage.append(svg);
    this.renderer = new GraphRenderer(svg, this.layout.width, this.layout.height);

    const figcaption = el('figcaption', 'graph-story__caption');
    this.title = el('div', 'graph-story__title');
    this.caption = el('div', 'graph-story__text');
    figcaption.append(this.title, this.caption);

    const nav = el('div', 'graph-story__nav');
    this.prevButton = button('graph-story__button graph-story__button--prev', 'Previous step', '←');
    this.nextButton = button('graph-story__button graph-story__button--next', 'Next step', '→');
    const dots = el('div', 'graph-story__dots');
    this.dots = this.steps.map((step, i) => {
      const dot = button('graph-story__dot', `Step ${i + 1}${step.title ? `: ${step.title}` : ''}`, '');
      dots.append(dot);
      return dot;
    });
    this.counter = el('span', 'graph-story__counter');
    nav.append(this.prevButton, dots, this.counter, this.nextButton);

    if (this.trigger === 'timeline') {
      this.playButton = button('graph-story__button graph-story__button--play', 'Play', '');
      nav.append(this.playButton);
    }

    this.figure.append(stage, figcaption, nav);
    container.append(this.figure);

    if (this.trigger === 'scroll') {
      // Full-screen scrollytelling: one explanation panel per step scrolls
      // past the pinned figure and drives the step index.
      const panels = el('div', 'graph-story__panels');
      this.panels = this.steps.map((step, i) => {
        const panel = el('article', 'graph-story__panel');
        panel.dataset.step = String(i);
        const card = el('div', 'graph-story__card');
        const kicker = el('div', 'graph-story__kicker');
        kicker.textContent = `${i + 1} / ${this.steps.length}`;
        const heading = el('h3', 'graph-story__panel-title');
        heading.textContent = step.title;
        const caption = el('p', 'graph-story__panel-caption');
        caption.innerHTML = step.caption;
        card.append(kicker, heading, caption);
        if (step.body) {
          const body = el('div', 'graph-story__panel-body');
          body.innerHTML = step.body;
          card.append(body);
        }
        panel.append(card);
        panels.append(panel);
        return panel;
      });
      container.append(panels);
    }

    container.tabIndex = 0;
  }

  private bindControls(): void {
    this.prevButton.addEventListener('click', () => {
      this.pause();
      this.prev();
    });
    this.nextButton.addEventListener('click', () => {
      this.pause();
      this.next();
    });
    this.dots.forEach((dot, i) =>
      dot.addEventListener('click', () => {
        this.pause();
        this.goTo(i);
      }),
    );
    this.playButton?.addEventListener('click', () => (this.playing ? this.pause() : this.play()));

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') {
        this.pause();
        this.next();
        event.preventDefault();
      } else if (event.key === 'ArrowLeft') {
        this.pause();
        this.prev();
        event.preventDefault();
      }
    };
    this.container.addEventListener('keydown', onKey);
    this.cleanups.push(() => this.container.removeEventListener('keydown', onKey));
  }

  private bindScroll(): void {
    const update = () => {
      this.scrollFrame = null;
      this.applyStep(this.stepFromScroll(), this.index === -1);
    };
    const schedule = () => {
      if (this.scrollFrame === null) this.scrollFrame = window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    this.cleanups.push(() => {
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    });
    update();
  }

  /** The active step is the last panel whose top has crossed the middle of the viewport. */
  private stepFromScroll(): number {
    const middle = window.innerHeight / 2;
    let index = 0;
    for (let i = 0; i < this.panels.length; i++) {
      if (this.panels[i].getBoundingClientRect().top <= middle) index = i;
    }
    return index;
  }

  private scrollToStep(index: number): void {
    const panel = this.panels[index];
    if (!panel) return;
    const target = window.scrollY + panel.getBoundingClientRect().top - window.innerHeight * 0.25;
    window.scrollTo({ top: target, behavior: this.reduceMotion ? 'auto' : 'smooth' });
  }

  private bindAutoplay(): void {
    if (this.reduceMotion) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) this.play();
          else this.pause();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(this.figure);
    this.cleanups.push(() => observer.disconnect());
  }

  private tickAutoplay(): void {
    if (!this.playing) return;
    this.timer = window.setTimeout(() => {
      if (this.index >= this.steps.length - 1) {
        this.applyStep(0, false);
      } else {
        this.next();
      }
      this.tickAutoplay();
    }, this.spec.interval ?? DEFAULT_INTERVAL);
  }

  private updateChrome(): void {
    const step = this.steps[this.index];
    this.title.textContent = step.title;
    this.caption.innerHTML = step.caption;
    this.counter.textContent = `${this.index + 1} / ${this.steps.length}`;
    this.prevButton.disabled = this.index === 0;
    this.nextButton.disabled = this.index === this.steps.length - 1;
    this.dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === this.index);
      dot.setAttribute('aria-current', i === this.index ? 'step' : 'false');
    });
    this.panels.forEach((panel, i) => panel.classList.toggle('is-active', i === this.index));
  }
}

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function button(className: string, label: string, text: string): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = className;
  node.setAttribute('aria-label', label);
  node.title = label;
  node.textContent = text;
  return node;
}
