import * as d3 from "d3";

export default class InterpolatedValue<T extends Object> {
  value: T;
  target: T;
  elasticity: number = 0.2;

  constructor(value: T) {
    this.value = value;
    this.target = value;
  }

  tick() {
    this.value = d3.interpolate<T>(this.value, this.target)(this.elasticity);
  }

  setValue(value: T) {
    this.target = value;
  }
}
