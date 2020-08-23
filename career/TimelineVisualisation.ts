import * as d3 from "d3";
import CanvasCursor from "./CanvasCursor";
import Scene from "./Scene";
import TimelineEvent from "./TimelineEvent";
import SmoothTransform from "./SmoothTransform";
import micromodal from "micromodal";

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
  ctx: CanvasRenderingContext2D;

  width: number = 0;
  height: number = 0;

  constructor(config: TimelineVisualisationConfig) {
    this.config = config;
    this.scene = new Scene();
    this.cursor = new CanvasCursor();
    this.smoothTransform = new SmoothTransform();
  }

  start() {
    this.width = this.config.container.getBoundingClientRect().width;
    this.height = 500;

    this.timeScale = d3
      .scaleTime()
      .domain([this.firstEvent.config.start, new Date()])
      .range([0, this.width]);

    this.zoom = d3
      .zoom()
      .scaleExtent([1, 8])
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
      .attr("width", this.width)
      .attr("height", this.height)
      .on("mousemove", () => {
        this.cursor.moveTo([d3.event.layerX, d3.event.layerY]);
      })
      .on("click", () => {
        this.cursor.moveTo([d3.event.layerX, d3.event.layerY]);
        this.cursor.isDown = true;
      })
      .on("mouseout", () => {
        this.cursor.hide();
      })
      .call(this.zoom);

    this.ctx = this.canvas.node().getContext("2d");
    this.scene.add(this.cursor);
    this.draw();
  }

  draw() {
    this.smoothTransform.tick();
    this.clear();
    this.scene.draw(this.ctx);
    this.processInteractions();
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
        console.log(event.config.name);
        micromodal.show("modal-life", {
          awaitOpenAnimation: true,
          awaitCloseAnimation: true,
        });
      }
    }

    this.cursor.isDown = false;
  }

  get firstEvent(): TimelineEvent {
    return this.config.events[0];
  }
}
