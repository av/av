import Drawable from "./Drawable";
import Transformable from "./Transformable";
import SmoothTransform from "./SmoothTransform";
import { Pair } from "../utils";

/**
 * Represents a time tick on a time scale of the visualisation.
 * Renders a line with a corresponding year.
 */
export default class TimeTick implements Drawable, Transformable {
  /**
   * Defines how to render event names.
   */
  static fontConfig = {
    font: '12px "Red Hat Display"',
    fill: 'rgba(0, 0, 0, .1)'
  };

  /**
   * Line stroke style
   */
  static strokeStyle = "rgba(0, 0, 0, .1)";

  /**
   * Width of the line stroke
   */
  static lineWidth = 2;

  /**
   * Height of the tick, year will be
   * rendered on top of this height.
   */
  static height = 8;

  /**
   * Constructs an array of ticks to be used
   * for the given range of dates
   * 
   * @param range - time range to build ticks for 
   */
  static yearTicks(range: Pair<Date, Date>) {
    const [start, end] = range;
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();

    return Array(endYear - startYear + 1)
      .fill(0)
      .map((_, i) => {
        return new Date(startYear + i, 1, 1);
      })
      .map(TimeTick.fromDate);
  }

  /**
   * Convenience helper to construct a Tick from
   * a given date
   * 
   * @param date - date to use for the tick
   */
  static fromDate(date: Date) {
    return new TimeTick(date);
  }

  /**
   * Represents tick X position in a unit viewport
   */
  x = 0;

  /**
   * Represents tick Y position in a unit viewport
   */
  y = 0;

  /**
   * Represents the date denominated by this tick
   */
  date: Date;

  /**
   * Holds the reference of current viewport transform
   */
  transform: SmoothTransform;

  constructor(date: Date) {
    this.date = date;
  }

  /**
   * Renders this component to the given canbas context
   * 
   * @param ctx - canvas context to use for render
   */
  draw(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = TimeTick.strokeStyle;
    ctx.lineWidth = TimeTick.lineWidth;

    const x = this.transform.currentTransform.applyX(this.x);
    const y = this.y;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - TimeTick.height);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = TimeTick.fontConfig.fill;
    ctx.font = TimeTick.fontConfig.font;
    ctx.fillText(
      this.date.getFullYear().toString(),
      x - 15,
      y - TimeTick.height - 5,
    );
  }

  /**
   * Applies given time scale to the component,
   * helping to determine correct viewport position.
   * 
   * @param scale - d3 scale representing the viewport
   */
  applyScale(scale: d3.ScaleTime<number, number>) {
    this.x = scale(this.date);
  }
}
