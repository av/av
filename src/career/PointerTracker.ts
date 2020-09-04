import * as d3 from "d3";
import { Offset, Pair } from "../utils";

/**
 * D3 adds a couple of new properties to captured
 * events which aren't exposed via bundled typings.
 */
type D3EventExtension = {
  layerX: number;
  layerY: number;
};

/**
 * Extending basic event types with D3 extensions
 */
type D3MouseEvent = MouseEvent & D3EventExtension;
type D3PointerEvent = PointerEvent & D3EventExtension;
type D3TouchEvent = TouchEvent & D3EventExtension;

/**
 * Abstract event which will be handled by {PointerTracker}
 */
type TrackedEvent = D3MouseEvent | D3TouchEvent | D3PointerEvent;

type PointerTypeDetector = { (event: TrackedEvent): boolean };
type PointerIdDetector = { (event: TrackedEvent): string };
type PointerPositionDetector = { (event: TrackedEvent): Offset };
type Detector<T> = Pair<PointerTypeDetector, T>[];

/**
 * Holds the reference of a captured pointer,
 * mouse or touch
 */
export class TrackedPointer {
  static idDetector: Detector<PointerIdDetector> = [
    [TrackedPointer.isMouseEvent, () => "mouse"],
    [
      TrackedPointer.isPointerEvent,
      (event: D3PointerEvent) => `pointer:${event.pointerId}`,
    ],
    [
      TrackedPointer.isTouchEvent,
      (event: D3TouchEvent) => `touch:${event.changedTouches[0].identifier}`,
    ],
  ];

  /**
   * Detects and returns a position of a
   */
  static positionDetector: Detector<PointerPositionDetector> = [
    [
      TrackedPointer.isMouseEvent,
      (event: D3MouseEvent) => [event.layerX, event.layerY],
    ],
    [
      TrackedPointer.isPointerEvent,
      (event: D3PointerEvent) => [event.layerX, event.layerY],
    ],
    [
      TrackedPointer.isTouchEvent,
      (event: D3TouchEvent) => [
        event.changedTouches[0].clientX,
        event.changedTouches[0].clientY,
      ],
    ],
  ];

  /**
   * Returns true if given event is sourced from mouse
   * @param e - event to process
   */
  static isMouseEvent(e: TrackedEvent) {
    return e.type.includes("mouse");
  }

  /**
   * Returns true if given event is sourced from pointer interface
   * @param e - event to process
   */
  static isPointerEvent(e: TrackedEvent) {
    return e.type.includes("pointer");
  }

  /**
   * Returns true if given event is sourced from touch device
   * @param e - event to process
   */
  static isTouchEvent(e: TrackedEvent) {
    return e.type.includes("touch");
  }

  /**
   * Determines a unique id of incoming pointer event,
   * regardless of event source and type.
   *
   * @param event - event to track
   */
  static getEventId(event: TrackedEvent): string {
    for (const [detector, assigner] of TrackedPointer.idDetector) {
      if (detector(event)) {
        return assigner(event);
      }
    }

    return "unknown";
  }

  static getEventPosition(event): Offset {
    for (const [tester, assigner] of TrackedPointer.positionDetector) {
      if (tester(event)) {
        return assigner(event);
      }
    }
  }

  /**
   * Current X position
   */
  x = 0;

  /**
   * Current Y position
   */
  y = 0;

  /**
   * Horizontal displacement from the 
   * initial recorded position
   */
  dx = 0;

  /**
   * Horizontal displacement from the 
   * initial recorded position
   */
  dy = 0;

  /**
   * Count of events recorded with this tracker
   */
  tracked = 0;

  constructor(position: Offset) {
    this.x = position[0];
    this.y = position[1];
  }

  /**
   * Records the given position of pointer
   * and detects the global offset relative to the initial
   * capturing point.
   *
   * @param position - new recorded position
   */
  track(position: Offset) {
    this.dx += position[0] - this.x;
    this.dy += position[1] - this.y;

    this.x = position[0];
    this.y = position[1];

    this.tracked++;
  }

  /**
   * Returns true if this pointer moves
   * vertically more than horizontally
   */
  get isVertical() {
    return Math.abs(this.dy) > Math.abs(this.dx);
  }
}

/**
 * Captures and records pointers over certain {d3.Selection}.
 */
export default class PointerTracker {
  /**
   * Flags if the tracker detected a scrolling attempt
   * by capturing a pointer with vertical movement.
   */
  isScrolling = false;

  /**
   * Holds references to the captured pointers.
   */
  pointers: Map<string, TrackedPointer> = new Map();

  constructor() {
    this.attach = this.attach.bind(this);
  }

  /**
   * Attaches this tracker to a given d3 selection,
   * starts listening and recording events and attempts to detect
   * vertical drags, considering them as a scrolling state.
   *
   * @param selection - d3 selection to bind events to
   */
  attach(selection: d3.Selection<HTMLElement, unknown, null, undefined>) {
    // Listeners have reassigned scope,
    // so capturing it in a closure.
    let scope = this;

    selection
      .on("pointerdown mousedown touchstart", () => {
        // Start tracking given pointer
        scope.pointers.set(
          TrackedPointer.getEventId(d3.event),
          new TrackedPointer(TrackedPointer.getEventPosition(d3.event))
        );
      })
      .on("pointermove mousemove touchmove", () => {
        const pointer = scope.pointers.get(TrackedPointer.getEventId(d3.event));

        if (pointer) {
          // If we're aware of this pointer, track it
          pointer.track(TrackedPointer.getEventPosition(d3.event));

          if (pointer.isVertical && pointer.tracked > 5) {
            scope.isScrolling = true;

            // Prevents the event from
            // bubbling over to parent element
            d3.event.stopPropagation();
          } else if (pointer.tracked > 5) {
            scope.isScrolling = false;
          }
        }
      })
      .on("pointerup mouseup touchend", () => {
        // Release the pointer
        scope.pointers.delete(TrackedPointer.getEventId(d3.event));

        // Releasing last pointer would mean
        // we definitely not in a scrolling state anymore
        if (scope.pointers.size === 0) {
          this.isScrolling = false;
        }
      });
  }
}
