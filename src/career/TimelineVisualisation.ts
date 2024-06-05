import * as d3 from 'd3';

import Scene from './Scene';
import CanvasCursor from './CanvasCursor';
import TimelineEvent from './TimelineEvent';
import SmoothTransform from './SmoothTransform';
import PointerTracker from './PointerTracker';
import { showModal, notifyVisibilityChange, Offset, Pair } from '../utils';
import { Ticks } from './Ticks';

interface TimelineVisualisationConfig {
  container: HTMLElement;
  events: Array<TimelineEvent>;
}

/**
 * A reverse flamechart visualisation.
 * Features:
 * - Detects user scroll attempts on mobile
 *   and prevents event capturing
 * - Smooth zooming
 * - Supports basic hit-tests for interacting with rendered data.
 * - Rendering is automatically paused when the container is
 *   scrolled off-screen.
 */
export default class TimelineVisualisation {
  /**
   * Desired visualisation height,
   * kept static for simplicity.
   */
  static height = 500;

  /**
   * Desired scale extent, minimal
   * and maximum levels of zoom allowed.
   */
  static scaleExtent: [number, number] = [1, 100];

  /**
   * Holds the reference to the configuration
   * of the component
   */
  config: TimelineVisualisationConfig;

  /**
   * Rendering scene, holding drawable components
   * of the visualisation and orchestrating the render pipeline
   */
  scene: Scene;

  /**
   * Virtual cursor to track mouse position and perform
   * the hit testing within the visualisation
   */
  cursor: CanvasCursor;

  /**
   * A component allowing to detect the scroll
   * attempt on mobile devices
   */
  tracker: PointerTracker;

  /**
   * Interpolated zoom transform, smoothly changing
   * its value, instead of quantified steps.
   */
  smoothTransform: SmoothTransform;

  /**
   * Holds a reference to timeline ticks,
   * denoting particular dates over X axis
   */
  ticks: Ticks;

  /**
   * Rendering context of the canvas of the visualisation.
   */
  ctx: CanvasRenderingContext2D;

  /**
   * Holds the chronological range of
   * the visualisation.
   */
  timeScale: d3.ScaleTime<number, number>;

  /**
   * D3 zoom used to source events for
   * performing smooth zooming.
   */
  zoom: d3.ZoomBehavior<Element, unknown>;

  /**
   * Holds the render target.
   */
  canvas: d3.Selection<HTMLCanvasElement, unknown, null, undefined>;

  /**
   * Holds the visualisation nodes,
   * incl. canvas and scroll detection overlay.
   */
  container: d3.Selection<HTMLElement, unknown, null, undefined>;

  /**
   * Flags whether rendering cycle is paused or running.
   */
  paused = true;

  /**
   * Width of the available viewport in logical pixels.
   */
  width = 0;

  /**
   * Height of the available viewport in logical pixels.
   */
  height = 500;

  constructor(config: TimelineVisualisationConfig) {
    this.config = config;
    this.scene = new Scene();
    this.cursor = new CanvasCursor();
    this.smoothTransform = new SmoothTransform();
    this.tracker = new PointerTracker();
  }

  /**
   * Initialises all the components required
   * for the visualisation to run.
   */
  start() {
    this.container = d3.select(this.config.container);
    this.width = this.config.container.getBoundingClientRect().width;

    const domain: Pair<Date, Date> = [this.firstEvent.config.start, new Date()];

    // Range from the earliest event till now
    // mapped to the visualisation viewport.
    this.timeScale = d3.scaleTime().domain(domain).range([0, this.width]);

    this.zoom = d3
      .zoom()
      .scaleExtent(TimelineVisualisation.scaleExtent)
      .translateExtent([
        [0, 0],
        [this.width, this.height],
      ])
      .on('zoom', this.onZoom.bind(this));

    // Adding events to the scene
    this.config.events.forEach((event) => {
      event.applyScale(this.timeScale);
      event.transform = this.smoothTransform;
      this.scene.add(event);
    });

    // Generate date scale ticks
    this.ticks = Ticks.forRange(domain)
      .scale(this.timeScale)
      .applyTransform(this.smoothTransform)
      .baseline(this.height);

    this.scene.add(this.ticks);

    this.canvas = d3
      .select(this.config.container)
      .append('canvas')
      .lower()
      .attr('width', this.width * this.dpr)
      .attr('height', this.height * this.dpr)
      .style('width', `${this.width}px`)
      .style('height', `${this.height}px`);

    this.container
      .on('pointermove', (e) => {
        this.cursor.moveTo([e.layerX, e.layerY]);
      })
      .on('click', (e) => {
        this.cursor.moveTo([e.layerX, e.layerY]);
        this.cursor.isDown = true;
      })
      .on('mouseout touchend', () => {
        this.cursor.hide();
      })
      .call(this.zoom)
      .style('touch-action', 'auto')
      .style('height', `${this.height}px`)
      .select('.scroller')
      .call(this.tracker.attach);

    this.ctx = this.canvas.node().getContext('2d');
    this.ctx.scale(this.dpr, this.dpr);
    this.scene.add(this.cursor);
    this.draw();

    // Pause the visualistaion when off-screen.
    notifyVisibilityChange(
      this.container.node(),
      this.onVisibilityChanged.bind(this)
    );
  }

  /**
   * Renders current state of the visualisation to the canvas.
   */
  draw() {
    if (!this.paused) {
      this.smoothTransform.tick();
      this.clear();
      this.scene.draw(this.ctx);
      this.processInteractions();
    }

    window.requestAnimationFrame(this.draw.bind(this));
  }

  /**
   * Clears the canvas by rendering the clear rect.
   */
  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  /**
   * Performs hit testing of the events
   * and currently captured cursor position.
   */
  processInteractions() {
    for (const event of this.config.events) {
      const isHovered = this.cursor.isOver(event.boundingRect);
      const isTriggered = isHovered && this.cursor.isDown;

      if (isTriggered) {
        this.onEventTriggered(event);

        // Only capture the very first hit
        // to avoid multiple events triggered at the same time.
        break;
      }
    }

    // Reset cursor regardless its current status
    // to avoid triggering events the next frame.
    this.cursor.isDown = false;
  }

  /**
   * Highlights event nodes with given tag,
   * by 'muting' the rest of the events.
   *
   * @param tag - Tag to highlight.
   */
  highlight(tag: string): void {
    for (const event of this.config.events) {
      if (event.config.tags.includes(tag)) {
        // Set event color to its initial desired value
        event.color.setValue(event.config.color);
      } else {
        // Mute the color of other events
        event.color.setValue('rgba(0, 0, 0, .05)');
      }
    }
  }

  /**
   * Handles {this.zoom} events by propagating
   * desired new transform to the interpolated transform container.
   */
  onZoom(e) {
    this.smoothTransform.targetTransform = e.transform;
  }

  /**
   * Performs a zoom in to the boundaries of a gieven event.
   *
   * @param event - one of the events passed to visualisation.
   */
  zoomIn(event: TimelineEvent) {
    // The scale of event in the unit coordinate system.
    const scale = (event.endX - event.startX) / this.width;

    this.container.call(
      this.zoom.transform,
      // Applying translate in the unit coords and then reversed scale
      // for an event to take the whole viewport.
      d3.zoomIdentity.scale(1 / scale).translate(-event.startX, 0)
    );
  }

  /**
   * Handles visualisation visibility change
   * by pausing/unpausing when necessary.
   *
   * @param isVisible - whether the visualisation is currently visible on screen.
   */
  onVisibilityChanged(isVisible) {
    this.paused = !isVisible;
  }

  /**
   * Handles trigger of the given event
   * by opening a modal with event contents and
   * pausing the render cycle whilst it's open.
   *
   * @param event - event which was triggered.
   */
  onEventTriggered(event: TimelineEvent) {
    this.paused = true;

    showModal(event.config.id, {
      onClose: () => (this.paused = false),
    });
  }

  /**
   * Returns the first event to be rendered.
   * Used as the chronological boundary for the time scale.
   */
  get firstEvent(): TimelineEvent {
    return this.config.events[0];
  }

  /**
   * Current device pixel ratio,
   * to be used for determining the proper Canvas scaling factor.
   */
  get dpr(): number {
    return window.devicePixelRatio || 1;
  }

  /**
   * Current viewport size.
   */
  get viewport(): Offset {
    return [this.width, this.height];
  }

  /**
   * Returns current possible translation
   * boundaries as allowed by current viewport dimensions.
   */
  get translateExtent(): [Offset, Offset] {
    return [[0, 0], this.viewport];
  }
}
