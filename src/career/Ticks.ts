import Drawable from './Drawable';
import { Pair, isBetween } from '../utils';
import TimeTick from './TimeTick';
import SmoothTransform from './SmoothTransform';
import { ScaleTime } from 'd3';

/**
 * Renders yearly ticks for a certain range,
 * adjusts the amount of ticks displayed as per
 * currently applied viewport transform.
 */
export class Ticks implements Drawable {
  /**
   * Builds yearly ticks for a given date range
   *
   * @param range - date range to build ticks from
   */
  static forRange(range: Pair<Date, Date>) {
    const [start, end] = range;
    const startYear = start.getFullYear();
    const endYear = end.getFullYear();
    const ticks = Array(endYear - startYear + 1)
      .fill(0)
      .map((_, i) => {
        return new Date(startYear + i, 1, 1);
      })
      .map(TimeTick.fromDate);

    return new Ticks(ticks);
  }

  /**
   * Holds tick components which will be rendered
   * within this scale
   */
  ticks: TimeTick[];

  /**
   * Holds a reference to currently
   * applied viewport transform
   */
  transform: SmoothTransform;

  /**
   * Holds a reference to a current viewport width
   * for adjusting the number of visible ticks
   */
  width: number;

  constructor(ticks: TimeTick[]) {
    this.ticks = ticks;
  }

  /**
   * Applies given scale to the component and all
   * its children to determine the viewport coordinates.
   *
   * @param scale
   */
  scale(scale: ScaleTime<number, number>): Ticks {
    this.width = scale.range()[1];

    for (const tick of this.ticks) {
      tick.applyScale(scale);
    }

    return this;
  }

  /**
   * Applies given transform to the component and
   * all its children
   *
   * @param transform - transform to apply
   */
  applyTransform(transform: SmoothTransform): Ticks {
    this.transform = transform;

    for (const tick of this.ticks) {
      tick.transform = transform;
    }

    return this;
  }

  /**
   * Applies the baseline for ticks to be rendered at.
   *
   * @param baseline - bottom line to render updwards from
   */
  baseline(baseline: number): Ticks {
    for (const tick of this.ticks) {
      tick.y = baseline;
    }

    return this;
  }

  /**
   * Renders ticks on a given canvas context.
   *
   * @param ctx - canvas context to render on
   */
  draw(ctx: CanvasRenderingContext2D) {
    const skipFactor = this.getSkipFactor();

    this.ticks.forEach((tick, i) => {
      if (i % skipFactor === 0) {
        tick.draw(ctx);
      }
    });
  }

  /**
   * Determines how many ticks need to be skipped to keep
   * them from clashing with each other,
   * depending on a current transform and viewport.
   */
  getSkipFactor(): number {
    const currentTransform = this.transform.currentTransform;
    const domain = [
      currentTransform.invertX(0),
      currentTransform.invertX(this.width),
    ];
    const currentTicks = this.ticks.filter((tick) =>
      isBetween(tick.x, domain[0], domain[1])
    ).length;
    const possibleTicks = this.width / 32;

    return Math.ceil(currentTicks / possibleTicks);
  }
}
