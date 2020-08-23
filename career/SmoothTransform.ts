import * as d3 from "d3";

export default class SmoothTransform {
  currentTransform: d3.ZoomTransform = d3.zoomIdentity;
  targetTransform: d3.ZoomTransform = d3.zoomIdentity;
  elasticity: number = 0.2;

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

  transformCtx(ctx: CanvasRenderingContext2D) {
    ctx.setTransform(
      new DOMMatrix()
        .scale(this.currentTransform.k)
        .translate(this.currentTransform.x, this.currentTransform.y, 0)
    );
  }
}
