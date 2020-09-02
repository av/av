import micromodal from "micromodal";
import mediumZoom from "medium-zoom";
import "gist-embed/dist/gist-embed.min.js";

export type CursorPosition = [number, number];
export type BoundingRect = [number, number, number, number];
export interface WidthChangeCallback {
  (width: number): void;
}
export interface ModalOptions {
  onShow?(): void;
  onClose?(): void;
}

export function isBetween(
  number: number,
  bottom: number,
  top: number
): boolean {
  return number >= bottom && number <= top;
}

export function overflowCanvasText(ctx, str, maxWidth): string {
  let width = ctx.measureText(str).width;
  const ellipsis = "...";
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

export function unpackTemplate(node: HTMLTemplateElement) {
  document.body.appendChild(node.content.cloneNode(true));
}

export function updateGeneratedContent() {
  mediumZoom("[data-zoomable]", {
    background: "rgba(0, 0, 0, .5)",
  });

  (<any>window).GistEmbed.init();
}

export function showModal(id: string, options: ModalOptions = {}) {
  const modalId = `#modal-${id}`;
  const modalTemplateId = `#modal-${id}-template`;

  if (!isPresent(modalId)) {
    unpackTemplate(qs(modalTemplateId) as HTMLTemplateElement);
  }

  micromodal.show(`modal-${id}`, {
    onShow: () => {
      addQueryParam("modal", id);
      disableScroll();
      options.onShow?.();
    },
    onClose: () => {
      removeQueryParam("modal");
      enableScroll();
      options.onClose?.();
    },
    awaitOpenAnimation: true,
    awaitCloseAnimation: true,
  });

  updateGeneratedContent();
}

export function disableScroll() {
  document.body.classList.add("no-scroll");
}

export function enableScroll() {
  document.body.classList.remove("no-scroll");
}

export function qs(selector: string) {
  return document.querySelector(selector);
}

export function isToday(date: Date) {
  return date.toDateString() === new Date().toDateString();
}

export function formatDateRange(start: Date, end: Date) {
  return `${start.toLocaleDateString()} - ${
    isToday(end) ? "present" : end.toLocaleDateString()
  }`;
}

export function addQueryParam(name: string, value: string) {
  const qs = new URLSearchParams(window.location.search);
  qs.set(name, value);
  setQueryString(qs);
}

export function removeQueryParam(name: string) {
  const qs = new URLSearchParams(window.location.search);
  qs.delete(name);
  setQueryString(qs);
}

export function setQueryString(qs: URLSearchParams) {
  window.history.replaceState(
    {},
    document.title,
    `${window.location.pathname}?${qs.toString()}`
  );
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

export function map(
  value: number,
  [from, to]: [number, number],
  [min, max]: [number, number]
) {
  return clamp(min + ((max - min) * (value - from)) / (to - from), min, max);
}

export function isPresent(selector: string) {
  return qs(selector) !== null;
}
