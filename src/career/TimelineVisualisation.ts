import * as d3 from "d3";
import CanvasCursor from "./CanvasCursor";
import Scene from "./Scene";
import TimelineEvent from "./TimelineEvent";
import SmoothTransform from "./SmoothTransform";
import { showModal } from "../utils";
import PointerTracker from "./PointerTracker";

interface TimelineVisualisationConfig {
  container: HTMLElement;
  events: Array<TimelineEvent>;
}

export default class TimelineVisualisation {
  config: TimelineVisualisationConfig;
  scene: Scene;
  timeScale: d3.ScaleTime<number, number>;
  cursor: CanvasCursor;
  zoom: d3.ZoomBehavior<Element, unknown>;
  smoothTransform: SmoothTransform;
  canvas: d3.Selection<HTMLCanvasElement, unknown, null, undefined>;
  container: d3.Selection<HTMLElement, unknown, null, undefined>;
  tracker: PointerTracker;
  ctx: CanvasRenderingContext2D;
  observer: IntersectionObserver;
  paused = true;

  width = 0;
  height = 500;

  constructor(config: TimelineVisualisationConfig) {
    this.config = config;
    this.scene = new Scene();
    this.cursor = new CanvasCursor();
    this.smoothTransform = new SmoothTransform();
    this.tracker = new PointerTracker();
  }

  start() {
    this.observer = new IntersectionObserver(
      this.onContainerIntersectionChanged.bind(this),
      {
        root: null,
        threshold: 0,
      }
    );

    this.container = d3.select(this.config.container);
    this.width = this.config.container.getBoundingClientRect().width;

    this.timeScale = d3
      .scaleTime()
      .domain([this.firstEvent.config.start, new Date()])
      .range([0, this.width]);

    this.zoom = d3
      .zoom()
      .scaleExtent([1, 100])
      .translateExtent([
        [0, 0],
        [this.width, this.height],
      ])
      .on("zoom", () => {
        this.smoothTransform.targetTransform = d3.event.transform;
      });

    this.config.events.forEach((event) => {
      event.applyScale(this.timeScale);
      event.transform = this.smoothTransform;
      this.scene.add(event);
    });

    this.canvas = d3
      .select(this.config.container)
      .append("canvas")
      .lower()
      .attr("width", this.width * this.dpr)
      .attr("height", this.height * this.dpr)
      .style("width", `${this.width}px`)
      .style("height", `${this.height}px`);

    this.container
      .on("pointermove", () => {
        this.cursor.moveTo([d3.event.layerX, d3.event.layerY]);
      })
      .on("click", () => {
        this.cursor.moveTo([d3.event.layerX, d3.event.layerY]);
        this.cursor.isDown = true;
      })
      .on("mouseout touchend", () => {
        this.cursor.hide();
      })
      .call(this.zoom)
      .style("touch-action", "auto")
      .style("height", `${this.height}px`)
      .select(".scroller")
      .call(this.tracker.attach);

    this.ctx = this.canvas.node().getContext("2d");
    this.ctx.scale(this.dpr, this.dpr);
    this.scene.add(this.cursor);
    this.observer.observe(this.container.node());
    this.draw();
  }

  draw() {
    if (!this.paused) {
      this.smoothTransform.tick();
      this.clear();
      this.scene.draw(this.ctx);
      this.processInteractions();
    }

    window.requestAnimationFrame(this.draw.bind(this));
  }

  clear() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  processInteractions() {
    for (const event of this.config.events) {
      const isHovered = this.cursor.isOver(event.boundingRect);
      const isTriggered = isHovered && this.cursor.isDown;

      if (isTriggered) {
        this.paused = true;
        showModal(event.config.id, {
          onClose: () => (this.paused = false),
        });
        break;
      }
    }

    this.cursor.isDown = false;
  }

  highlight(tags: Array<string>): void {
    for (const event of this.config.events) {
      if (tags.every((tag) => event.config.tags.includes(tag))) {
        event.color.setValue(event.config.color);
      } else {
        event.color.setValue("rgba(0, 0, 0, .05)");
      }
    }
  }

  zoomIn(event: TimelineEvent) {
    const scale = (event.endX - event.startX) / this.width;
    this.container.call(
      this.zoom.transform,
      d3.zoomIdentity.scale(1 / scale).translate(-event.startX, 0)
    );
  }

  onContainerIntersectionChanged([change]: Array<IntersectionObserverEntry>) {
    this.paused = !change.isIntersecting;
  }

  get firstEvent(): TimelineEvent {
    return this.config.events[0];
  }

  get dpr(): number {
    return window.devicePixelRatio || 1;
  }
}
