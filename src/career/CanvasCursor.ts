import Drawable from "./Drawable";
import { isBetween, CursorPosition, BoundingRect } from "../utils";
import InterpolatedValue from "./InterpolatedValue";

export default class CanvasCursor implements Drawable {
  static hiddenSize = 0;
  static visibleSize = 35;

  position: InterpolatedValue<CursorPosition> = new InterpolatedValue([0, 0]);
  size: InterpolatedValue<number> = new InterpolatedValue(0);
  isDown: boolean = false;

  moveTo(position: CursorPosition) {
    this.position.setValue(position);
    this.size.setValue(CanvasCursor.visibleSize);
  }

  hide() {
    this.size.setValue(CanvasCursor.hiddenSize);
  }

  isOver(rect: BoundingRect): boolean {
    const position = this.position.target;

    return (
      isBetween(position[0], rect[0], rect[1]) &&
      isBetween(position[1], rect[2], rect[3])
    );
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.size.tick();
    this.position.tick();

    const position = this.position.value;

    ctx.beginPath();
    ctx.fillStyle = "rgba(0, 0, 0, .05)";
    ctx.moveTo(position[0], position[1]);
    ctx.arc(position[0], position[1], this.size.value, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
  }
}
