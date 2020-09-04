import Drawable from "./Drawable";
import { BoundingRect, overflowCanvasText } from "../utils";
import SmoothTransform from "./SmoothTransform";
import InterpolatedValue from "./InterpolatedValue";

interface TimelineEventConfig {
  id: string,
  start: Date;
  end: Date;
  name: string;
  color: string;
  depth: number;
  tags: string[],
}

export default class TimelineEvent implements Drawable {
  config: TimelineEventConfig;
  startX: number = 0;
  endX: number = 0;
  startY: number = 0;
  endY: number = 0;
  lineHeight: number = 50;
  transform: SmoothTransform;
  color: InterpolatedValue<string>;

  constructor(config: TimelineEventConfig) {
    this.config = config;
    this.color = new InterpolatedValue(this.config.color);
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.color.tick();

    const startX = this.transform.currentTransform.applyX(this.startX);
    const endX = this.transform.currentTransform.applyX(this.endX);
    const length = endX - startX;

    ctx.beginPath();
    ctx.fillStyle = this.color.value;
    ctx.save();
    ctx.rect(startX, this.startY, length, this.lineHeight);
    ctx.clip();
    ctx.fill();
    ctx.closePath();
    ctx.fillStyle = "white";
    ctx.font = '32px "Red Hat Display"';
    ctx.fillText(
      this.config.name,
      startX + 10,
      this.startY + 38,
    );
    ctx.restore();
  }

  applyScale(scale: d3.ScaleTime<number, number>) {
    this.startX = scale(this.config.start);
    this.endX = scale(this.config.end);
    this.startY = this.config.depth * this.lineHeight;
    this.endY = this.startY + this.lineHeight;
  }

  get boundingRect(): BoundingRect {
    const startX = this.transform.currentTransform.applyX(this.startX);
    const endX = this.transform.currentTransform.applyX(this.endX);

    return [startX, endX, this.startY, this.endY];
  }
}
