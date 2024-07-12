import Drawable from '../lib/Drawable';
import { Rect } from '../utils';
import SmoothTransform from '../lib/SmoothTransform';
import InterpolatedValue from '../lib/InterpolatedValue';
import Transformable from '../lib/Transformable';

interface TimelineEventConfig {
  id: string,
  start: Date;
  end: Date;
  name: string;
  color: string;
  depth: number;
  tags: string[],
}

/**
 * A component representing of the events
 * for the {TimelineVisualisation}.
 *
 * Holds necessary data points and could
 * be rendered to the given canvas context.
 */
export default class TimelineEvent implements Drawable, Transformable {
  /**
   * Defines the rendered height of an event
   */
  static lineHeight = 50;

  /**
   * Defines how to render event names.
   */
  static fontConfig = {
    font: '24px "Red Hat Display"',
    fill: '#ffffffda'
  };

  config: TimelineEventConfig;
  startX: number = 0;
  endX: number = 0;
  startY: number = 0;
  endY: number = 0;

  /**
   * Holds the instance of a transform applied
   * to the parent viewport of the event.
   */
  transform: SmoothTransform;

  /**
   * Allows to transition between different
   * event colors.
   */
  color: InterpolatedValue<string>;

  constructor(config: TimelineEventConfig) {
    this.config = config;
    this.color = new InterpolatedValue(this.config.color);
  }

  /**
   * Renders the event to the given canvas context.
   *
   * @param ctx - canvas context
   */
  draw(ctx: CanvasRenderingContext2D) {
    // Advance the color transition
    // if necessary.
    this.color.tick();

    // Detect actual position of the event
    // based on the current transform of the viewport
    const startX = this.transform.currentTransform.applyX(this.startX);
    const endX = this.transform.currentTransform.applyX(this.endX);
    const length = endX - startX;

    // Render event body.
    ctx.beginPath();
    ctx.fillStyle = this.color.value;
    ctx.strokeStyle = this.color.value;
    ctx.save();
    ctx.rect(startX, this.startY, length, TimelineEvent.lineHeight);

    // Clip the drawn rect, so that event
    // name doesn't overflow the boundary
    ctx.clip();
    ctx.fill();
    ctx.stroke();
    ctx.closePath();

    // Render event name.
    ctx.fillStyle = TimelineEvent.fontConfig.fill;
    ctx.font = TimelineEvent.fontConfig.font;
    ctx.fillText(
      this.config.name,
      startX + 10,
      this.startY + 38,
    );
    ctx.restore();
  }

  /**
   * Rescales the desired event position in the unit
   * viewport, based on the given time scale instance.
   *
   * @param scale - scale holding the viewport domain
   *   and chronological range of the visualisation.
   */
  applyScale(scale: d3.ScaleTime<number, number>) {
    this.startX = scale(this.config.start);
    this.endX = scale(this.config.end);
    this.startY = this.config.depth * TimelineEvent.lineHeight;
    this.endY = this.startY + TimelineEvent.lineHeight;
  }

  /**
   * Returns the current bounding rect for the event,
   * with current scale applied.
   *
   * Used for hit testing.
   */
  get boundingRect(): Rect {
    const startX = this.transform.currentTransform.applyX(this.startX);
    const endX = this.transform.currentTransform.applyX(this.endX);

    return [startX, endX, this.startY, this.endY];
  }
}
