import Drawable from "./Drawable";

export default class Scene implements Drawable {
  components: Array<Drawable> = [];

  add(component: Drawable) {
    this.components.push(component);
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.components.forEach((component) => {
      component.draw(ctx);
    });
  }
}
