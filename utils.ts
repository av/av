export type CursorPosition = [number, number];
export type BoundingRect = [number, number, number, number];

export function isBetween(number: number, bottom: number, top: number): boolean {
  return number >= bottom && number <= top;
}

export function overflowCanvasText(ctx, str, maxWidth): string {
  let width = ctx.measureText(str).width;
  const ellipsis = '...';
  const ellipsisWidth = ctx.measureText(ellipsis).width;

  if (width <= maxWidth || width <= ellipsisWidth) {
    return str;
  } else {
    let length = str.length;

    while(width >= maxWidth - ellipsisWidth && length-- > 0) {
      str = str.substring(0, length);
      width = ctx.measureText(str).width;
    }
    
    return str + ellipsis;
  }
}