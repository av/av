import GraphLayout, { STAGE_WIDTH, boundsOf } from './layout';
import type { Box, Layout } from './layout';
import GraphRenderer from './renderer';
import { createTextMeasurer } from './shapes';
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
const CAMERA_PADDING = 70;
/** How long a queued scroll-mode jump keeps steering next/prev, in ms. */
const PENDING_TTL = 1200;
/** A focused view never zooms in past this share of the layout width. */
const MIN_VIEW_SHARE = 0.55;
/** Share of the centred square the focus fills; the rest is breathing room. */
const CONTENT_FILL = 0.84;
/** Stage widths below this are treated as a phone. */
const NARROW_STAGE_PX = 560;
/**
 * A phone can only hold two or three cards across at a readable size, so a
 * narrow stage frames the action tightly and lets context fade off-frame.
 */
const PORTRAIT_MIN_SHARE = 0.24;
const PORTRAIT_MAX_SHARE = 0.38;
const SCROLL_STEP_HEIGHT_VH = 65;
/** How many layouts to request ahead of the reader. */
const WARM_AHEAD = 4;

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
  private layout!: GraphLayout;
  /** Layout requests per step; each step is laid out once and replayed from here. */
  private readonly layouts: Promise<Layout>[] = [];
  /** Layouts that have arrived, for code that cannot wait (resize). */
  private readonly ready: Layout[] = [];
  /** Step whose layout is on screen; trails `index` while a layout is in flight. */
  private shown = -1;
  private viewAspect = 1.6;
  private stageWidthPx = 0;
  private svg: SVGSVGElement | null = null;
  private renderer: GraphRenderer | null = null;
  private index = -1;
  private reduceMotion = false;

  private figure!: HTMLElement;
  private chromeTitle!: HTMLElement;
  private panels: HTMLElement[] = [];
  private panelTops: number[] = [];
  private title!: HTMLElement;
  private caption!: HTMLElement;
  private kicker!: HTMLElement;
  private note!: HTMLElement;
  private counter!: HTMLElement;
  private dots: HTMLButtonElement[] = [];
  private dotStrip!: HTMLElement;
  private prevButton!: HTMLButtonElement;
  private nextButton!: HTMLButtonElement;
  private playButton: HTMLButtonElement | null = null;

  /** Step a scroll-mode jump is heading for, so rapid clicks queue instead of fighting the scroll handler. */
  private pendingIndex: number | null = null;
  private pendingAt = 0;
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

    this.bindResize();
    this.warmLayouts();
    return this;
  }

  /**
   * The stage box changes with the window, and the camera is fitted to it, so
   * re-frame on resize. The layout itself is left alone: recomputing it would
   * move every node for what is only a change of viewport.
   */
  private bindResize(): void {
    let frame: number | null = null;
    const onResize = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(() => {
        frame = null;
        this.panelTops = [];
        if (!this.svg || this.shown < 0) return;
        this.measureStage(this.svg);
        this.renderer?.setCamera(this.cameraFor(this.ready[this.shown], this.steps[this.shown]), 0);
      });
    };
    window.addEventListener('resize', onResize);
    this.cleanups.push(() => {
      window.removeEventListener('resize', onResize);
      if (frame !== null) window.cancelAnimationFrame(frame);
    });
  }

  /** Reads the stage box; the camera fits content to it, so this can change with the window. */
  private measureStage(svg: SVGSVGElement): void {
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    this.stageWidthPx = rect.width;
    this.viewAspect =
      this.trigger === 'scroll' ? Math.min(2.2, Math.max(0.55, rect.width / rect.height)) : (this.spec.aspect ?? 1.6);
  }

  /**
   * Layout for a step, requested once. A step's layout depends only on its own
   * state and the story, so the order steps are visited in cannot change a picture.
   */
  private layoutFor(index: number): Promise<Layout> {
    let pending = this.layouts[index];
    if (!pending) {
      pending = this.layout.compute(this.steps[index].state).then((layout) => {
        this.ready[index] = layout;
        return layout;
      });
      this.layouts[index] = pending;
    }
    return pending;
  }

  /**
   * Requests the next few layouts so the reader rarely waits. Layouts are
   * computed in a worker, so this costs the page nothing but a message; the
   * current step was requested first and is served first.
   */
  private warmLayouts(): void {
    const from = Math.max(this.index, 0);
    for (let i = from + 1; i < Math.min(this.steps.length, from + 1 + WARM_AHEAD); i++) void this.layoutFor(i);
  }

  destroy(): void {
    this.pause();
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.container.replaceChildren();
    this.container.classList.remove('is-ready');
  }

  next(): void {
    this.goTo(Math.min(this.steps.length - 1, this.stepCursor() + 1));
  }

  prev(): void {
    this.goTo(Math.max(0, this.stepCursor() - 1));
  }

  /**
   * Where the next step should be counted from. In scroll mode a jump is a
   * smooth scroll, so a click that lands mid-flight must continue from the
   * pending target rather than from whatever the scroll handler last saw.
   */
  private stepCursor(): number {
    if (this.pendingIndex === null) return this.index;
    return performance.now() - this.pendingAt < PENDING_TTL ? this.pendingIndex : this.index;
  }

  goTo(index: number, immediate = false): void {
    if (index === this.index || index < 0 || index >= this.steps.length) return;

    if (this.trigger === 'scroll' && !immediate) {
      this.pendingIndex = index;
      this.pendingAt = performance.now();
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
    if (index === this.index) return;
    this.index = index;
    this.updateChrome();
    this.options.onStep?.(index, this.steps[index]);

    void this.layoutFor(index).then((layout) => {
      // The reader may have moved on while this layout was in flight.
      if (this.index !== index) return;
      const jump = Math.abs(index - this.shown) > 1 || this.shown === -1;
      const duration = immediate || this.shown === -1 || this.reduceMotion ? 0 : (this.options.duration ?? DEFAULT_DURATION) * (jump ? 0.6 : 1);
      const step = this.steps[index];
      this.shown = index;
      this.renderer?.render(layout, duration, step.focus);
      this.renderer?.setCamera(this.cameraFor(layout, step), duration);
    });
    this.warmLayouts();
  }

  /**
   * What the camera should frame: the step's focus, plus the panels the action
   * sits in. Half a panel in frame reads as a rendering mistake.
   */
  private framedBounds(layout: Layout, step: ResolvedStep, portrait: boolean): Box | null {
    // On a wide stage, whole panels around the action: half a panel in frame
    // reads as a rendering mistake. On a narrow one there is no room for that,
    // so the frame holds the changed nodes and nothing else.
    const groups = new Set([...step.focus.groups, ...step.focus.panels]);
    if (!portrait) {
      for (const node of layout.nodes) {
        if (step.focus.nodes.has(node.id)) for (const id of node.path) groups.add(id);
      }
    }
    return boundsOf(layout, step.focus.nodes, groups);
  }

  /** Centre of the focused nodes, so a frame too small to hold them all keeps the action middle. */
  private focusCentre(layout: Layout, step: ResolvedStep): { x: number; y: number } | null {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (const node of layout.nodes) {
      if (!step.focus.nodes.has(node.id)) continue;
      sumX += node.x;
      sumY += node.y;
      count++;
    }
    return count > 0 ? { x: sumX / count, y: sumY / count } : null;
  }

  /**
   * Frames the step's focus so it lands in a square-ish region at the centre
   * of the stage. Fitting to the stage aspect instead would stretch the
   * content along whichever axis the window happens to be long in, and on a
   * tall stage it would cut the focus off at top and bottom.
   */
  private cameraFor(layout: Layout, step: ResolvedStep): Box {
    const full = boundsOf(layout) ?? { x: 0, y: 0, width: STAGE_WIDTH, height: STAGE_WIDTH / this.viewAspect };
    // Only a genuinely narrow stage (a phone) trades completeness for size.
    const narrow = this.stageWidthPx > 0 && this.stageWidthPx < NARROW_STAGE_PX;
    const focused = step.focus.all ? null : this.framedBounds(layout, step, narrow);
    const box = focused ?? full;

    // Side of the centred square the content has to fit inside.
    const side = Math.max(box.width, box.height) / CONTENT_FILL;
    let width = this.viewAspect >= 1 ? side * this.viewAspect : side;
    width = Math.max(width, STAGE_WIDTH * MIN_VIEW_SHARE);

    // A phone cannot hold a wide spread at a readable size: cap the zoom-out
    // and let the far side fade off-frame rather than shrink the text.
    if (narrow) width = Math.min(Math.max(width, STAGE_WIDTH * PORTRAIT_MIN_SHARE), STAGE_WIDTH * PORTRAIT_MAX_SHARE);
    const height = width / this.viewAspect;

    // Centre on the action when the frame is too small to hold the whole box.
    const centre = this.focusCentre(layout, step);
    const tooSmall = centre !== null && (width < box.width || height < box.height);
    const cx = tooSmall && centre ? centre.x : box.x + box.width / 2;
    const cy = tooSmall && centre ? centre.y : box.y + box.height / 2;

    // Keep the frame inside the focus box so a slice stays full of content
    // instead of drifting into empty canvas.
    return {
      x: clampSpan(cx - width / 2, width, box.x, box.width),
      y: clampSpan(cy - height / 2, height, box.y, box.height),
      width,
      height,
    };
  }

  private buildDom(): void {
    const { container } = this;
    container.replaceChildren();
    container.classList.add(GraphStory.selectors.root, `is-trigger-${this.trigger}`, 'is-ready');
    container.style.setProperty('--gs-steps', String(this.steps.length));
    container.style.setProperty('--gs-step-height', `${SCROLL_STEP_HEIGHT_VH}vh`);

    this.figure = el('figure', 'graph-story__figure');
    const stage = el('div', 'graph-story__stage');
    // A framed screen so the diagram reads as a window over the page's
    // animated background rather than floating on top of it.
    const screen = el('div', 'graph-story__screen');
    const chrome = el('div', 'graph-story__chrome');
    this.chromeTitle = el('span', 'graph-story__chrome-title');
    chrome.append(this.chromeTitle);

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'graph-story__svg');
    svg.setAttribute('role', 'img');
    screen.append(chrome, svg);
    stage.append(screen);
    this.figure.append(stage);
    container.append(this.figure);

    // The camera fits each step to the stage's real aspect (portrait on
    // phones); the layout itself does not depend on the window.
    this.svg = svg;
    this.measureStage(svg);
    this.layout = new GraphLayout(
      this.steps.map((step) => step.state),
      createTextMeasurer(),
    );
    this.renderer = new GraphRenderer(svg, STAGE_WIDTH, Math.round(STAGE_WIDTH / this.viewAspect));

    const figcaption = el('figcaption', 'graph-story__caption');
    this.title = el('div', 'graph-story__title');
    this.caption = el('div', 'graph-story__text');
    // Kicker and note are shown where the caption stands in for the scroll
    // panels (scroll mode on a phone); elsewhere the stylesheet hides them.
    this.kicker = el('div', 'graph-story__caption-kicker');
    this.note = el('div', 'graph-story__caption-note');
    figcaption.append(this.kicker, this.title, this.caption, this.note);

    const nav = el('div', 'graph-story__nav');
    this.prevButton = button('graph-story__button graph-story__button--prev', 'Previous step', '<');
    this.nextButton = button('graph-story__button graph-story__button--next', 'Next step', '>');
    const dots = el('div', 'graph-story__dots');
    this.dotStrip = dots;
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

    // The stepper is the screen's status bar, the counterpart of its title bar.
    screen.append(nav);
    this.figure.append(figcaption);

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
      const step = this.stepFromScroll();
      if (step === this.pendingIndex) this.pendingIndex = null;
      this.applyStep(step, this.index === -1);
    };
    const schedule = () => {
      if (this.scrollFrame === null) this.scrollFrame = window.requestAnimationFrame(update);
    };
    window.addEventListener('scroll', schedule, { passive: true });
    this.cleanups.push(() => window.removeEventListener('scroll', schedule));
    update();
  }

  /**
   * The active step is the last panel whose top has crossed the middle of the
   * viewport. Panel tops are cached: measuring all of them on every scroll
   * frame forces a layout flush per frame, which is the page's worst jank.
   */
  private stepFromScroll(): number {
    if (this.panelTops.length !== this.panels.length) this.measurePanels();
    const middle = window.scrollY + window.innerHeight / 2;
    let index = 0;
    for (let i = 0; i < this.panelTops.length; i++) {
      if (this.panelTops[i] <= middle) index = i;
    }
    return index;
  }

  private measurePanels(): void {
    this.panelTops = this.panels.map((panel) => panel.getBoundingClientRect().top + window.scrollY);
  }

  private scrollToStep(index: number): void {
    if (this.panelTops.length !== this.panels.length) this.measurePanels();
    const top = this.panelTops[index];
    if (top === undefined) return;
    const target = top - window.innerHeight * 0.25;
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
    this.kicker.textContent = `${this.index + 1} / ${this.steps.length}`;
    this.note.innerHTML = step.body;
    const width = String(this.steps.length).length;
    this.counter.textContent = `${String(this.index + 1).padStart(width, '0')}/${this.steps.length}`;
    this.chromeTitle.textContent = step.title;
    this.prevButton.disabled = this.index === 0;
    this.nextButton.disabled = this.index === this.steps.length - 1;
    this.dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === this.index);
      dot.classList.toggle('is-done', i < this.index);
      dot.setAttribute('aria-current', i === this.index ? 'step' : 'false');
    });
    this.panels.forEach((panel, i) => panel.classList.toggle('is-active', i === this.index));
    this.revealActiveDot();
  }

  /**
   * The step strip scrolls sideways rather than shrinking its blocks to fit,
   * so keep the current step in the middle of it. Only the strip scrolls:
   * scrollIntoView would also move the page, which drives scroll mode.
   */
  private revealActiveDot(): void {
    const strip = this.dotStrip;
    const dot = this.dots[this.index];
    if (!dot || strip.scrollWidth <= strip.clientWidth) return;
    const left = dot.offsetLeft - (strip.clientWidth - dot.offsetWidth) / 2;
    strip.scrollTo({ left, behavior: this.reduceMotion ? 'auto' : 'smooth' });
  }
}

/** Slides a span of `size` back inside `[start, start + extent]` when it fits. */
function clampSpan(value: number, size: number, start: number, extent: number): number {
  if (size >= extent) return value;
  return Math.min(Math.max(value, start), start + extent - size);
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
