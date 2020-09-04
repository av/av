import Drawable from "./Drawable";
import { isBetween, Offset, Rect, PI2 } from "../utils";
import InterpolatedValue from "./InterpolatedValue";

/**
 * Implements a basic capture device
 * for holding a reference to currently hovered position
 * and later performing hit-testing against it.
 *
 * Could be rendered to the canvas in an arbitrary way.
 */
export default class CanvasCursor implements Drawable {
  /**
   * Size of the cursor area when hidden.
   */
  static hiddenSize = 0;

  /**
   * Size of the cursor area when visible.
   */
  static visibleSize = 35;

  /**
   * Cursor fill style when rendered.
   */
  static fillStyle = "rgba(0, 0, 0, .05)";

  /**
   * Holds the interpolated cursor position, which tries to reach
   * preset target value.
   */
  position: InterpolatedValue<Offset> = new InterpolatedValue([0, 0]);

  /**
   * Holds the interpolated cursor size, which tries to reach
   * preset target value.
   */
  size: InterpolatedValue<number> = new InterpolatedValue(0);

  /**
   * Defines if the cursor currently active
   * and performs hit-testing in the next frame.
   */
  isDown: boolean = false;

  /**
   * Sets the cursor target position to a given offset.
   *
   * @param position - desired cursor position
   */
  moveTo(position: Offset) {
    this.position.setValue(position);
    this.size.setValue(CanvasCursor.visibleSize);
  }

  /**
   * Hides the cursor by gradually decreasing its
   * size to 0.
   */
  hide() {
    this.size.setValue(CanvasCursor.hiddenSize);
  }

  /**
   * Performs the hit testing of actual cursor
   * position (not interpolated) and the given rect.
   *
   * @param rect - rectangle to hit test
   */
  isOver(rect: Rect): boolean {
    const position = this.position.target;

    return (
      isBetween(position[0], rect[0], rect[1]) &&
      isBetween(position[1], rect[2], rect[3])
    );
  }

  /**
   * Renders the cursor to given canvas context.
   *
   * @param ctx - context for rendering
   */
  draw(ctx: CanvasRenderingContext2D) {
    // Update interpolated values
    this.size.tick();
    this.position.tick();

    // Position where cursor will be rendered.
    const [x, y] = this.position.value;

    ctx.beginPath();
    ctx.fillStyle = CanvasCursor.fillStyle;
    ctx.moveTo(x, y);
    ctx.arc(x, y, this.size.value, 0, PI2);
    ctx.fill();
    ctx.closePath();
  }
}
