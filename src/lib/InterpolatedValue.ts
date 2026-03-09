import * as d3 from 'd3';
import Updatable from './Updatable';

/**
 * LERPs encapsulated value to target value with elasticity
 * on every tick. When damping < 1, spring physics are used
 * instead — velocity accumulates and decays, producing
 * overshoot and inertia.
 */
export default class InterpolatedValue<T extends Object> implements Updatable {
  value: T;
  target: T;
  elasticity: number;
  damping: number;
  private velocity: number[];

  constructor(value: T, elasticity: number = 0.2, damping: number = 1) {
    this.value = value;
    this.target = value;
    this.elasticity = elasticity;
    this.damping = damping;
    this.velocity = Array.isArray(value)
      ? new Array((value as number[]).length).fill(0)
      : [0];
  }

  /**
   * Advance the spring simulation by `dt` normalised frames.
   * `dt` should be `elapsed / (1000 / 60)` so that 1.0 equals one
   * 60 fps frame; values above or below scale force and damping
   * accordingly, making the simulation frame-rate independent.
   */
  tick(dt: number = 1) {
    if (this.damping < 1) {
      // Frame-rate-independent spring:
      //   force  = (target − value) × stiffness × dt
      //   damping is applied as an exponential decay: damping^dt
      const vals    = Array.isArray(this.value)  ? (this.value  as unknown as number[]) : [this.value  as unknown as number];
      const targets = Array.isArray(this.target) ? (this.target as unknown as number[]) : [this.target as unknown as number];
      const dampingDt = Math.pow(this.damping, dt);

      const next = vals.map((v, i) => {
        const force = (targets[i] - v) * this.elasticity * dt;
        this.velocity[i] = (this.velocity[i] + force) * dampingDt;
        return v + this.velocity[i];
      });

      this.value = (Array.isArray(this.value) ? next : next[0]) as unknown as T;
    } else {
      // For LERP mode, scale the interpolation factor by dt so speed
      // stays constant regardless of frame rate.
      const alpha = 1 - Math.pow(1 - this.elasticity, dt);
      this.value = d3.interpolate<T>(this.value, this.target)(alpha);
    }
  }

  setValue(value: T) {
    this.target = value;
  }
}
