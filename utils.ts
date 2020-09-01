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
  document.body.appendChild(node.content);
}

export function updateGeneratedContent() {
  mediumZoom("[data-zoomable]", {
    background: "rgba(0, 0, 0, .5)",
  });

  (<any>window).GistEmbed.init();
}

export function showModal(id: string, options: ModalOptions = {}) {
  unpackTemplate(document.querySelector(`#modal-${id}-template`));

  micromodal.show(`modal-${id}`, {
    onShow: () => {
      disableScroll();
      options.onShow?.();
    },
    onClose: () => {
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

export function qs(selector) {
  return document.querySelector(selector);
}

export function isToday(date: Date) {
  return date.toDateString() === new Date().toDateString();
}

export function formatDateRange(start: Date, end: Date) {
  return `${start.toLocaleDateString()} - ${isToday(end) ? 'present' : end.toLocaleDateString()}`;
}