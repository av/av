import SmoothTransform from "./SmoothTransform";

/**
 * Represents an entity to be placed within a
 * smoothly scaled canvas viewport
 */
export default interface Transformable {
  /**
   * Holds a reference to the current transform
   * which should be applied for the entity's dimensions
   */
  transform: SmoothTransform;

  /**
   * Applies given time scale to the entity, so that
   * It can determine where its dimensions should exists
   * within a viewport
   * 
   * @param scale - time scale to apply
   */
  applyScale(scale: d3.ScaleTime<number, number>): void;
}
