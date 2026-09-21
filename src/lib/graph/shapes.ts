import type { NodeShape } from './types';

const POINTS = 36;

interface Superellipse {
  a: number;
  b: number;
  n: number;
}

const SUPERELLIPSES: Record<'circle' | 'rect' | 'diamond', Superellipse> = {
  circle: { a: 1, b: 1, n: 2 },
  // A high exponent gives near-square corners.
  rect: { a: 1.3, b: 0.95, n: 14 },
  diamond: { a: 1.25, b: 1.25, n: 1 },
};

function superellipsePoint(shape: Superellipse, r: number, theta: number): [number, number] {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const e = 2 / shape.n;
  return [
    r * shape.a * Math.sign(c) * Math.abs(c) ** e,
    r * shape.b * Math.sign(s) * Math.abs(s) ** e,
  ];
}

type Polygon = [number, number][];

/** Chamfered rectangle (octagon), unit radius. */
const PILL: Polygon = [
  [-1.15, -0.8], [1.15, -0.8], [1.45, -0.45], [1.45, 0.45], [1.15, 0.8], [-1.15, 0.8], [-1.45, 0.45], [-1.45, -0.45],
];

/** Flat-topped hexagon, unit radius. */
const HEX: Polygon = Array.from({ length: 6 }, (_, i) => {
  const angle = (i / 6) * Math.PI * 2;
  return [1.1 * Math.cos(angle), 1.1 * Math.sin(angle)];
});

/** Distance from the origin to a convex polygon's boundary along `theta`. */
function polygonRadius(polygon: Polygon, theta: number): number {
  const dx = Math.cos(theta);
  const dy = Math.sin(theta);
  let best = Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const [x0, y0] = polygon[i];
    const [x1, y1] = polygon[(i + 1) % polygon.length];
    const ex = x1 - x0;
    const ey = y1 - y0;
    const denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) < 1e-9) continue;
    const t = (x0 * ey - y0 * ex) / denominator;
    const u = (x0 * dy - y0 * dx) / denominator;
    if (t > 0 && u >= -1e-9 && u <= 1 + 1e-9) best = Math.min(best, t);
  }
  return best === Infinity ? 1 : best;
}

function pointFor(shape: NodeShape, r: number, theta: number): [number, number] {
  if (shape === 'hex' || shape === 'pill') {
    const radius = r * polygonRadius(shape === 'hex' ? HEX : PILL, theta);
    return [radius * Math.cos(theta), radius * Math.sin(theta)];
  }
  return superellipsePoint(SUPERELLIPSES[shape], r, theta);
}

/**
 * Every shape is sampled into the same number of points so the renderer can
 * tween one `d` string into another when a node changes kind or size.
 */
export function shapePath(shape: NodeShape, r: number): string {
  const parts: string[] = [];
  for (let i = 0; i < POINTS; i++) {
    const theta = (i / POINTS) * Math.PI * 2 - Math.PI / 2;
    const [x, y] = pointFor(shape, r, theta);
    parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `${parts.join('')}Z`;
}

/** Horizontal / vertical extents of a shape, used to trim edges at the node boundary. */
export function shapeRadius(shape: NodeShape, r: number, theta: number): number {
  const [x, y] = pointFor(shape, r, theta);
  return Math.hypot(x, y);
}
