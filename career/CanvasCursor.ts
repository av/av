import Drawable from "./Drawable";
import { isBetween, CursorPosition, BoundingRect } from "../utils";

export default class CanvasCursor implements Drawable {
  position: CursorPosition = [0, 0];
  isDown: boolean = false;

  moveTo(position: CursorPosition) {
    this.position = position;
  }

  hide() {
    this.moveTo([-100, -100]);
  }

  isOver(rect: BoundingRect): boolean {
    return (
      isBetween(this.position[0], rect[0], rect[1]) &&
      isBetween(this.position[1], rect[2], rect[3])
    );
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.beginPath();
    ctx.fillStyle = "rgba(0, 0, 0, .1)";
    ctx.moveTo(this.position[0], this.position[1]);
    ctx.arc(this.position[0], this.position[1], 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.closePath();
  }
}
