import type { NodeShape } from './types';

/**
 * Nodes are drawn as terminal-style cards: a box sized to its own text, with
 * the label inside. Kind is carried by a sigil and by the corner treatment,
 * not by an outline silhouette, so labels can never collide with the graph.
 */

export const LABEL_SIZE = 15;
export const SUBLABEL_SIZE = 11;
export const PIXEL_FONT = "'Geist Pixel', 'Geist Mono', ui-monospace, monospace";
/** Fallback advance width, as a fraction of font size, when nothing can measure text. */
const CHAR_ADVANCE = 0.68;
const SIGIL_WIDTH = 15;
const PAD_X = 11;
const CARD_HEIGHT = 30;
const CARD_HEIGHT_TWO_LINE = 44;
const CHAMFER = 6;
const ROUND = 4;

/** ASCII sigils read as terminal markers rather than decoration. */
const KIND_SIGILS: Record<string, string> = {
  human: '@',
  agent: '*',
  service: '#',
  tool: '>',
  repo: '/',
  skill: '+',
  model: '%',
  chat: '?',
  machine: '=',
};

export function sigilForKind(kind: string | undefined): string {
  return (kind && KIND_SIGILS[kind]) || '·';
}

/** Measures a run of text at a font size, in user units. */
export type TextMeasurer = (text: string, fontSize: number) => number;

export const estimateTextWidth: TextMeasurer = (text, size) => text.length * size * CHAR_ADVANCE;

/**
 * Real measurement against the actual webfont. Estimating advance widths
 * overflowed cards whenever the guess ran short, which is most of the time
 * for a proportional fallback.
 */
export function createTextMeasurer(): TextMeasurer {
  const context = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  if (!context) return estimateTextWidth;

  const cache = new Map<string, number>();
  return (text, size) => {
    const key = `${size}:${text}`;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    context.font = `500 ${size}px ${PIXEL_FONT}`;
    const width = context.measureText(text).width;
    cache.set(key, width);
    return width;
  };
}

export interface CardSize {
  width: number;
  height: number;
}

/** Natural size of a card, before any `size` multiplier. */
export function measureCard(label: string, sublabel: string, measure: TextMeasurer = estimateTextWidth): CardSize {
  const width = Math.max(measure(label, LABEL_SIZE), measure(sublabel, SUBLABEL_SIZE));
  return {
    width: Math.max(72, Math.ceil(width + SIGIL_WIDTH + PAD_X * 2)),
    height: sublabel ? CARD_HEIGHT_TWO_LINE : CARD_HEIGHT,
  };
}

/** Where the label text starts, relative to the card centre. */
export function labelOffsetX(width: number): number {
  return -width / 2 + PAD_X + SIGIL_WIDTH;
}

export function sigilOffsetX(width: number): number {
  return -width / 2 + PAD_X;
}

type Corner = 'square' | 'round' | 'chamfer';

const CORNERS: Record<NodeShape, Corner> = {
  rect: 'square',
  hex: 'chamfer',
  diamond: 'chamfer',
  pill: 'round',
  circle: 'round',
};

/** Card outline. Corners differ per shape so kinds stay distinguishable. */
export function cardPath(shape: NodeShape, width: number, height: number): string {
  const w = width / 2;
  const h = height / 2;
  const corner = CORNERS[shape];

  if (corner === 'square') {
    return `M${-w},${-h}H${w}V${h}H${-w}Z`;
  }

  if (corner === 'chamfer') {
    const c = Math.min(CHAMFER, w, h);
    return [
      `M${-w + c},${-h}`,
      `H${w - c}`,
      `L${w},${-h + c}`,
      `V${h - c}`,
      `L${w - c},${h}`,
      `H${-w + c}`,
      `L${-w},${h - c}`,
      `V${-h + c}`,
      'Z',
    ].join('');
  }

  const r = Math.min(ROUND, w, h);
  return [
    `M${-w + r},${-h}`,
    `H${w - r}`,
    `A${r},${r} 0 0 1 ${w},${-h + r}`,
    `V${h - r}`,
    `A${r},${r} 0 0 1 ${w - r},${h}`,
    `H${-w + r}`,
    `A${r},${r} 0 0 1 ${-w},${h - r}`,
    `V${-h + r}`,
    `A${r},${r} 0 0 1 ${-w + r},${-h}`,
    'Z',
  ].join('');
}

/**
 * Distance from a card's centre to its edge along `theta`. Used to trim edges
 * so they stop at the box rather than running under it.
 */
export function cardRadius(width: number, height: number, theta: number): number {
  const dx = Math.cos(theta);
  const dy = Math.sin(theta);
  const w = width / 2;
  const h = height / 2;
  const tx = Math.abs(dx) < 1e-6 ? Infinity : w / Math.abs(dx);
  const ty = Math.abs(dy) < 1e-6 ? Infinity : h / Math.abs(dy);
  return Math.min(tx, ty);
}
