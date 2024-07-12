import micromodal from 'micromodal';
import mediumZoom from 'medium-zoom';

// Unfortunately the package dosn't have
// a better import option for ESM or TS,
// so picking from dist directly.
import 'gist-embed/dist/gist-embed.min.js';

/**
 * Denotes a pair of typed entities, smashed into an array.
 */
export type Pair<T, K> = [T, K];

/**
 * Essentially, represents a vector in cartesian space,
 * my warm 👋 to Flutter for the name.
 */
export type Offset = Pair<number, number>;

/**
 * Describes a rectangle with its top-left corner, width and height
 */
export type Rect = [number, number, number, number];

/**
 * Handles change of width of an entity.
 */
export interface WidthChangeCallback {
  (width: number): void;
}

/**
 * Handles change of the visibility of an entity.
 */
export interface VisbilityChangedCallback {
  (isVisible: boolean): void;
}

/**
 * Configuration options for opening a modal.
 */
export interface ModalOptions {
  /**
   * If specified, will be called
   * when modal is fully shown.
   */
  onShow?(): void;

  /**
   * Will be called after opened modal
   * has fully disappeared from the screen
   */
  onClose?(): void;
}

/**
 * Double PI, to avoid repetitive computations in runtime.
 */
export const PI2 = Math.PI * 2;

/**
 * Returns true if given number falls within a range
 * between bottom and top boundaries.
 *
 * @param number - number to check
 * @param bottom - bottom boundary
 * @param top - top boundary
 */
export function isBetween(
  number: number,
  bottom: number,
  top: number
): boolean {
  return number >= bottom && number <= top;
}

/**
 * For a given canvas context, verifies that given
 * text could be rendered within a certain amount of pixels.
 * If that's not possible, overflows the text with ellipsis until
 * it fits within the given length, or is exhausted.
 *
 * @param ctx - canvas context to use for render
 * @param str - string to fit within required length
 * @param maxWidth - maximum length text can take
 */
export function overflowCanvasText(
  ctx: CanvasRenderingContext2D,
  str: string,
  maxWidth: number
): string {
  let width = ctx.measureText(str).width;
  const ellipsis = '...';
  const ellipsisWidth = ctx.measureText(ellipsis).width;

  if (width <= maxWidth || width <= ellipsisWidth) {
    return str;
  } else {
    let length = str.length;

    while (width >= maxWidth - ellipsisWidth && length-- > 0) {
      str = str.substring(0, length);
      width = ctx.measureText(str).width;
    }

    return str + ellipsis;
  }
}

/**
 * For a given template node, unpacks its contents
 * to the document body, so it could be accessed via root document.
 *
 * @param node - template node to unpack
 */
export function unpackTemplate(node: HTMLTemplateElement) {
  document.body.appendChild(node.content.cloneNode(true));
}

/**
 * Updates embeddable portions of content.
 * As soon as new embeddable content is injected to the page,
 * this code needs to be re-run to reinitialise newly added elements.
 */
export function initEmbeddables() {
  mediumZoom('[data-zoomable]', {
    background: 'rgba(0, 0, 0, .5)',
  });

  // GistEmbed doesn't play nice and pollutes globals.
  // On the other hand, it helps to overcome document.write after
  // the document was closed for writing, which is in all Gists, by default.
  (<any>window).GistEmbed.init();
}

/**
 * Shows a modal with given id by preparing its template
 * and then calling micromodal with necessary options.
 *
 * @param id - string id of modal to open
 * @param options - options for micromodal
 */
export function showModal(id: string, options: ModalOptions = {}) {
  const modalId = `#modal-${id}`;
  const modalTemplateId = `#modal-${id}-template`;

  if (!isPresent(modalId)) {
    unpackTemplate(qs(modalTemplateId) as HTMLTemplateElement);
  }

  micromodal.show(`modal-${id}`, {
    onShow: () => {
      addQueryParam('modal', id);
      disableScroll();
      options.onShow?.();
    },
    onClose: () => {
      removeQueryParam('modal');
      enableScroll();
      options.onClose?.();
    },
    awaitOpenAnimation: true,
    awaitCloseAnimation: true,
  });

  // As modal may contain gists, or pictures,
  // re-initialising the generated content
  initEmbeddables();
}

/**
 * Disables scrolling on the topmost level on the page.
 */
export function disableScroll() {
  document.body.classList.add('no-scroll');
}

/**
 * Re-enables scrolling on the topmost level on the page.
 */
export function enableScroll() {
  document.body.classList.remove('no-scroll');
}

/**
 * Selects a single element with given selector and
 * wraps them with an Array.
 *
 * @param selector - any CSS compatible selector
 */
export function qs<T extends HTMLElement>(selector: string): T {
  return document.querySelector(selector);
}

/**
 * Selects multiple elements with given selector and
 * wraps them with an Array.
 *
 * @param selector - any CSS compatible selector
 */
export function qsa(selector: string): HTMLElement[] {
  return Array.from(document.querySelectorAll(selector));
}

/**
 * Throttles given function so it's not called
 * more frequently than is defined by specified delay.
 *
 * @param fn - function to throttle
 * @param delay - function will only be called
 *   after this time passed since the last call
 */
export function throttle(fn, delay) {
  let last = 0;
  let timeout;

  return function () {
    const now = Date.now();
    const sinceLast = now - last;

    clearTimeout(timeout);

    if (sinceLast > delay) {
      last = now;
      fn(...arguments);
    } else {
      timeout = setTimeout(() => {
        last = Date.now();
        fn(...arguments);
      }, delay - sinceLast);
    }
  };
}

/**
 * Checks if the given date is today.
 *
 * @param date - date to check
 */
export function isToday(date: Date) {
  return date.toDateString() === new Date().toDateString();
}

/**
 * For a given start and end dates, formats them to locale
 * readable date range.
 * If the end of the range is today, replaces it with 'present'.
 *
 * @param start - start of the range
 * @param end - end of the range
 */
export function formatDateRange(start: Date, end: Date) {
  return `${start.toLocaleDateString()} - ${isToday(end) ? 'present' : end.toLocaleDateString()
    }`;
}

/**
 * Appends a query parameter with given name
 * and value to the current location without reloading it
 *
 * @param name - name of query parameter
 * @param value - value of query paramter
 */
export function addQueryParam(name: string, value: string) {
  const qs = new URLSearchParams(window.location.search);
  qs.set(name, value);
  setQueryString(qs);
}

/**
 * Appends a query parameter with given name
 * from the current location without reloading it
 *
 * @param name - name of query parameter
 */
export function removeQueryParam(name: string) {
  const qs = new URLSearchParams(window.location.search);
  qs.delete(name);
  setQueryString(qs);
}

/**
 * For a given URLSearchParams, adds them
 * to the current location without reloading it.
 *
 * @param qs - constructed query parameters
 */
export function setQueryString(qs: URLSearchParams) {
  window.history.replaceState(
    {},
    document.title,
    `${window.location.pathname}?${qs.toString()}`
  );
}

/**
 * Clamps the given value so it never exceeds the given range.
 *
 * @param value - value to clamp
 * @param min - bottom boundary
 * @param max - top boundary
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

/**
 * Maps given value from a given domain
 * to a given output range, preventing it from
 * overflowing any of the boundaries
 *
 * @param value - value to map
 * @param domain - input domain
 * @param range - output range for the value
 */
export function map(
  value: number,
  [from, to]: Pair<number, number>,
  [min, max]: Pair<number, number>
) {
  return clamp(min + ((max - min) * (value - from)) / (to - from), min, max);
}

/**
 * Returns true if given selector could be found in the DOM
 *
 * @param selector - selector to check
 */
export function isPresent(selector: string) {
  return qs(selector) !== null;
}

/**
 * Scrolls a given selector to the view.
 *
 * @param selector - selector to scroll into view.
 */
export function scrollTo(selector: string) {
  const target = qs(selector);

  if (target) {
    target.scrollIntoView();
  }
}

/**
 * Returns a random element from a given array.
 *
 * @param arr - source array to pick from
 */
export function any<T>(arr: Array<T>): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * For a given element, creates an IntesectionObserver
 * and calls a given callback as soon as element
 * exits or enters the view.
 *
 * @param el - element to call
 * @param onVisibilityChanged - function to be called when element
 *   exits or enters the view
 */
export function notifyVisibilityChange(
  el: HTMLElement,
  onVisibilityChanged: VisbilityChangedCallback
) {
  const observer = new IntersectionObserver(
    ([change]: Array<IntersectionObserverEntry>) => {
      onVisibilityChanged(change.isIntersecting);
    },
    {
      root: null,
      threshold: 0,
    }
  );

  observer.observe(el);
}

export function toggleDisplay(els: HTMLElement | HTMLElement[], isVisible: boolean) {
  if (!Array.isArray(els)) {
    els = [els];
  }

  for (const el of els) {
    el.style.display = isVisible ? null : 'none';
  }
}