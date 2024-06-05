import * as d3 from 'd3';

/**
 * Represents an interpolated transform which
 * could be changed smoothly over time.
 */
export default class SmoothTransform {
  /**
   * Holds the current transform which should be used
   * for all the dependent computations to be smooth
   */
  currentTransform: d3.ZoomTransform = d3.zoomIdentity;

  /**
   * Holds the target transform which the component
   * will advance towards on each tick.
   */
  targetTransform: d3.ZoomTransform = d3.zoomIdentity;

  /**
   * Elasticity of the transform.
   * 0 - won't move towards target at all
   * 1 - will rigidly stick to the target
   */
  elasticity: number = 0.2;

  /**
   * Recalculates current transform
   * towards the target transform, by interpolating
   * the scale, and translations.
   */
  tick() {
    const targetZoom = [
      this.targetTransform.x,
      this.targetTransform.y,
      this.targetTransform.k,
    ];
    const currentZoom = [
      this.currentTransform.x,
      this.currentTransform.y,
      this.currentTransform.k,
    ];

    const interpolatedZoom = d3.interpolate(
      currentZoom,
      targetZoom
    )(this.elasticity);

    this.currentTransform = d3.zoomIdentity
      .translate(interpolatedZoom[0], interpolatedZoom[1])
      .scale(interpolatedZoom[2]);
  }

  /**
   * Applies the transform to given canvas context.
   *
   * @param ctx - canvas context
   */
  transformCtx(ctx: CanvasRenderingContext2D) {
    ctx.setTransform(
      new DOMMatrix()
        .scale(this.currentTransform.k)
        .translate(this.currentTransform.x, this.currentTransform.y, 0)
    );
  }
}
