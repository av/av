import * as d3 from "d3";
import { CursorPosition } from "../utils";

export class TrackedPointer {
  x = 0;
  y = 0;
  dx = 0;
  dy = 0;
  tracked = 0;

  constructor(position: CursorPosition) {
    this.x = position[0];
    this.y = position[1];
  }

  track(position: CursorPosition) {
    this.dx += position[0] - this.x;
    this.dy += position[1] - this.y;

    this.x = position[0];
    this.y = position[1];

    this.tracked++;
  }

  get isVertical() {
    return Math.abs(this.dy) > Math.abs(this.dx);
  }
}

export default class PointerTracker {
  isScrolling = false;
  pointers: Map<string, TrackedPointer> = new Map();

  constructor() {
    this.attach = this.attach.bind(this);
  }

  attach(selection) {
    let scope = this;

    selection
      .on("pointerdown mousedown touchstart", () => {
        scope.pointers.set(
          scope.getEventId(d3.event),
          new TrackedPointer(scope.getEventPosition(d3.event))
        );
      })
      .on("pointermove mousemove touchmove", () => {
        const pointer = scope.pointers.get(scope.getEventId(d3.event));

        if (pointer) {
          pointer.track(scope.getEventPosition(d3.event));

          if (pointer.isVertical && pointer.tracked > 5) {
            scope.isScrolling = true;
            d3.event.stopPropagation();
          } else if (pointer.tracked > 5) {
            scope.isScrolling = false;
          }
        }
      })
      .on("pointerup mouseup touchend", () => {
        scope.pointers.delete(scope.getEventId(d3.event));

        if (scope.pointers.size === 0) {
          this.isScrolling = false;
        }
      });
  }

  getEventId(event) {
    const detectors = [
      [this.isMouseEvent, () => "mouse"],
      [this.isPointerEvent, () => `pointer:${event.pointerId}`],
      [this.isTouchEvent, () => `touch:${event.changedTouches[0].identifier}`],
    ];

    for (const [tester, assigner] of detectors) {
      if (tester(event)) {
        return assigner(event);
      }
    }

    return "unknown";
  }

  getEventPosition(event) {
    const detectors = [
      [this.isMouseEvent, () => [event.layerX, event.layerY]],
      [this.isPointerEvent, () => [event.layerX, event.layerY]],
      [
        this.isTouchEvent,
        () => [
          event.changedTouches[0].clientX,
          event.changedTouches[0].clientY,
        ],
      ],
    ];

    for (const [tester, assigner] of detectors) {
      if (tester(event)) {
        return assigner(event);
      }
    }
  }

  isMouseEvent(e) {
    return e.type.includes("mouse");
  }

  isPointerEvent(e) {
    return e.type.includes("pointer");
  }

  isTouchEvent(e) {
    return e.type.includes("touch");
  }
}
