import micromodal from "micromodal";
import mediumZoom from "medium-zoom";

export type CursorPosition = [number, number];
export type BoundingRect = [number, number, number, number];

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

export function showModal(id: string): void {
  unpackTemplate(document.querySelector(`#modal-${id}-template`));

  micromodal.show(`modal-${id}`, {
    awaitOpenAnimation: true,
    awaitCloseAnimation: true,
  });

  mediumZoom("[data-zoomable]", {
    background: "rgba(0, 0, 0, .5)",
  });  
}
