import type { NodeShape } from './types';

const POINTS = 36;

interface Superellipse {
  a: number;
  b: number;
  n: number;
}

const SUPERELLIPSES: Record<Exclude<NodeShape, 'hex'>, Superellipse> = {
  circle: { a: 1, b: 1, n: 2 },
  rect: { a: 1.3, b: 0.95, n: 7 },
  pill: { a: 1.45, b: 0.8, n: 3.2 },
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

function hexPoint(r: number, theta: number): [number, number] {
  // Distance to a flat-topped hexagon boundary at angle theta.
  const sector = ((theta % (Math.PI / 3)) + Math.PI / 3) % (Math.PI / 3);
  const radius = (r * 1.1 * Math.cos(Math.PI / 6)) / Math.cos(sector - Math.PI / 6);
  return [radius * Math.cos(theta), radius * Math.sin(theta)];
}

/**
 * Every shape is sampled into the same number of points so the renderer can
 * tween one `d` string into another when a node changes kind or size.
 */
export function shapePath(shape: NodeShape, r: number): string {
  const parts: string[] = [];
  for (let i = 0; i < POINTS; i++) {
    const theta = (i / POINTS) * Math.PI * 2 - Math.PI / 2;
    const [x, y] = shape === 'hex' ? hexPoint(r, theta) : superellipsePoint(SUPERELLIPSES[shape], r, theta);
    parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `${parts.join('')}Z`;
}

/** Horizontal / vertical extents of a shape, used to trim edges at the node boundary. */
export function shapeRadius(shape: NodeShape, r: number, theta: number): number {
  const [x, y] = shape === 'hex' ? hexPoint(r, theta) : superellipsePoint(SUPERELLIPSES[shape], r, theta);
  return Math.hypot(x, y);
}
