import Drawable from "./Drawable";
import { BoundingRect, overflowCanvasText } from "../utils";
import SmoothTransform from "./SmoothTransform";

interface TimelineEventConfig {
  start: Date;
  end: Date;
  name: string;
  color: string;
  depth: number;
}

export default class TimelineEvent implements Drawable {
  config: TimelineEventConfig;
  startX: number = 0;
  endX: number = 0;
  startY: number = 0;
  endY: number = 0;
  lineHeight: number = 50;
  boundingRect: BoundingRect = [0, 0, 0, 0];
  transform: SmoothTransform;

  constructor(config: TimelineEventConfig) {
    this.config = config;
  }

  draw(ctx: CanvasRenderingContext2D) {
    let startX = this.transform.currentTransform.applyX(this.startX);
    let endX = this.transform.currentTransform.applyX(this.endX);
    let length = endX - startX;

    ctx.beginPath();
    ctx.fillStyle = this.config.color;
    ctx.rect(startX, this.startY, length, this.lineHeight);
    ctx.fill();
    ctx.closePath();
    ctx.fillStyle = "white";
    ctx.font = '32px "Red Hat Display"';
    ctx.fillText(
      overflowCanvasText(ctx, this.config.name, length),
      startX + 10,
      this.startY + 38,
    );
  }

  applyScale(scale: d3.ScaleTime<number, number>) {
    this.startX = scale(this.config.start);
    this.endX = scale(this.config.end);
    this.startY = this.config.depth * this.lineHeight;
    this.endY = this.startY + this.lineHeight;
    this.boundingRect = [this.startX, this.endX, this.startY, this.endY];
  }
}
