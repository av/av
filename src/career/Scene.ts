import Drawable from './Drawable';

/**
 * Basic scene container to host multiple
 * drawable instances.
 */
export default class Scene implements Drawable {
  components: Array<Drawable> = [];

  /**
   * Adds the component to the scene, making
   * it renderable as soon as scene renders.
   *
   * @param component - instance to add to the scene
   */
  add(component: Drawable) {
    this.components.push(component);
  }

  /**
   * For a given context, renders all the
   * stored drawable components to the canvas
   *
   * @param ctx - context to render to
   */
  draw(ctx: CanvasRenderingContext2D) {
    this.components.forEach((component) => {
      component.draw(ctx);
    });
  }


}
