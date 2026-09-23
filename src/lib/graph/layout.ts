import type { ELK } from 'elkjs/lib/elk-api';

import { buildElkGraph, readElkLayout, storyAffinity } from './elkGraph';
import type { Affinity, Direction, Point, Size } from './elkGraph';
import { estimateTextWidth, measureCard } from './shapes';
import type { TextMeasurer } from './shapes';
import { edgeId } from './story';
import type { Accent, EdgeSpec, GraphState, GroupSpec, NodeShape, NodeSpec } from './types';

export type { Point } from './elkGraph';

/** Nominal canvas width the camera's zoom limits are expressed against. */
export const STAGE_WIDTH = 1500;

/** Layer direction. Top-down keeps both stories close to the stage's shape. */
const DIRECTION: Direction = 'DOWN';
const EDGE_LABEL_SIZE = 11;
const EDGE_LABEL_PAD_X = 10;
const EDGE_LABEL_HEIGHT = 16;
/** Group titles are uppercase and letter-spaced, so the plate needs slack. */
export const GROUP_LABEL_SIZE = 12;
const GROUP_LABEL_TRACKING = 0.12;
export const GROUP_LABEL_PAD = 9;
export const GROUP_LABEL_HEIGHT = 16;
/** Where a group's legend starts, from the panel's left edge. */
export const GROUP_LABEL_X = 12;
/** Clear space kept between a legend plate and an edge crossing the panel border. */
const LEGEND_CLEARANCE = 6;
/** Layout passes allowed for making room under legends that edges crossed. */
const LEGEND_PASSES = 3;

export interface LayoutNode {
  id: string;
  spec: NodeSpec;
  /** Card centre. */
  x: number;
  y: number;
  /** Card size, already scaled by the spec's `size` multiplier. */
  width: number;
  height: number;
  shape: NodeShape;
  color: Accent;
  /** Outermost-first chain of group ids. */
  path: string[];
}

export interface LayoutEdge {
  id: string;
  spec: EdgeSpec;
  color: Accent;
  /** Orthogonal route from the source's border (card or group panel) to the target's. */
  points: Point[];
  /** Label plate, placed by the layout so it never sits on a card or another edge. */
  label: Box | null;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutGroup {
  id: string;
  spec: GroupSpec;
  depth: number;
  color: Accent;
  box: Box;
  /** Legend plate on the panel's top border, moved clear of any edge crossing it. */
  legend: Box | null;
}

export interface Layout {
  width: number;
  height: number;
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  groups: LayoutGroup[];
}

/** Bounding box of a set of nodes and groups (everything, routes included, when both are omitted). */
export function boundsOf(layout: Layout, nodeIds?: Set<string>, groupIds?: Set<string>): Box | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const all = !nodeIds && !groupIds;
  const extend = (ax: number, ay: number, bx: number, by: number) => {
    x0 = Math.min(x0, ax);
    y0 = Math.min(y0, ay);
    x1 = Math.max(x1, bx);
    y1 = Math.max(y1, by);
  };
  for (const n of layout.nodes) {
    if (all || nodeIds?.has(n.id)) extend(n.x - n.width / 2, n.y - n.height / 2, n.x + n.width / 2, n.y + n.height / 2);
  }
  for (const g of layout.groups) {
    if (all || groupIds?.has(g.id)) extend(g.box.x, g.box.y - GROUP_LABEL_HEIGHT / 2, g.box.x + g.box.width, g.box.y + g.box.height);
  }
  if (all) {
    for (const e of layout.edges) for (const p of e.points) extend(p.x, p.y, p.x, p.y);
  }
  if (x0 === Infinity) return null;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

const KIND_SHAPES: Record<string, NodeShape> = {
  machine: 'rect',
  tool: 'rect',
  service: 'pill',
  chat: 'pill',
  model: 'pill',
  agent: 'circle',
  human: 'circle',
  skill: 'diamond',
  repo: 'hex',
};

export function shapeForKind(kind: string | undefined): NodeShape {
  return (kind && KIND_SHAPES[kind]) || 'circle';
}

/** Legend width for a group label: uppercase, letter-spaced, with padding either side. */
export function legendWidth(label: string | undefined, measure: TextMeasurer): number {
  if (!label) return 0;
  const text = label.toUpperCase();
  const tracking = text.length * GROUP_LABEL_SIZE * GROUP_LABEL_TRACKING;
  return measure(text, GROUP_LABEL_SIZE) + tracking + GROUP_LABEL_PAD * 2;
}

let sharedElk: Promise<ELK> | null = null;

/**
 * ELK runs in a worker: a layered layout of a busy step takes a few hundred
 * milliseconds, which would otherwise be a long task on the reader's scroll.
 * Where workers are unavailable the bundled build runs on the main thread.
 */
function elk(): Promise<ELK> {
  if (!sharedElk) {
    sharedElk = (async () => {
      if (typeof Worker !== 'undefined') {
        const { default: ElkApi } = await import('elkjs/lib/elk-api');
        return new ElkApi({ workerFactory: () => new Worker(new URL('npm:elkjs/lib/elk-worker.min.js', import.meta.url)) });
      }
      const { default: ElkBundled } = await import('elkjs/lib/elk.bundled.js');
      return new ElkBundled();
    })();
  }
  return sharedElk;
}

/**
 * Layered layout (ELK): cards in layers, groups as compound boxes, edges
 * routed orthogonally with even spacing and labels placed by the layout.
 * Each step is a pure function of its state and the story it belongs to, so
 * any step can be computed in any order and always produces the same picture.
 */
export default class GraphLayout {
  private readonly measure: TextMeasurer;
  private readonly affinity: Affinity;

  /** `story` is every state the layout will be asked for; siblings are ordered by all of them. */
  constructor(story: GraphState[], measure: TextMeasurer = estimateTextWidth) {
    this.measure = measure;
    this.affinity = storyAffinity(story, edgeId);
  }

  async compute(state: GraphState): Promise<Layout> {
    const groupById = new Map(state.groups.map((g) => [g.id, g]));
    const cards = new Map<string, Size>();
    for (const spec of state.nodes) {
      const card = measureCard(spec.label ?? spec.id, spec.sublabel ?? '', this.measure);
      // Text is not scaled, so a smaller card never gets narrower than its label.
      const scale = spec.size ?? 1;
      cards.set(spec.id, { width: card.width * Math.max(1, scale), height: card.height * scale });
    }
    const edgeLabels = new Map<string, Size>();
    for (const spec of state.edges) {
      if (spec.label) edgeLabels.set(edgeId(spec), { width: this.measure(spec.label, EDGE_LABEL_SIZE) + EDGE_LABEL_PAD_X, height: EDGE_LABEL_HEIGHT });
    }
    const groupLabels = new Map<string, Size>();
    for (const spec of state.groups) {
      if (spec.label) groupLabels.set(spec.id, { width: legendWidth(spec.label, this.measure), height: GROUP_LABEL_HEIGHT });
    }

    // A legend with no clear run on its panel's border gets room of its own,
    // and the step is laid out again. Rarely needed, and bounded.
    const legendRoom = new Set<string>();
    let layout: Layout | null = null;
    for (let pass = 0; pass < LEGEND_PASSES; pass++) {
      const { graph, reversed } = buildElkGraph({ state, direction: DIRECTION, cards, edgeLabels, groupLabels, edgeId, affinity: this.affinity, legendRoom });
      const placement = readElkLayout(await (await elk()).layout(graph), new Set(groupById.keys()), reversed);
      const { layout: attempt, blocked } = this.assemble(state, placement, cards, groupLabels);
      layout = attempt;
      const fresh = blocked.filter((id) => !legendRoom.has(id));
      if (fresh.length === 0) break;
      for (const id of fresh) legendRoom.add(id);
    }
    return layout!;
  }

  private assemble(
    state: GraphState,
    placement: ReturnType<typeof readElkLayout>,
    cards: Map<string, Size>,
    groupLabels: Map<string, Size>,
  ): { layout: Layout; blocked: string[] } {
    const groupById = new Map(state.groups.map((g) => [g.id, g]));

    const depthOf = (spec: GroupSpec): number => {
      let depth = 0;
      for (let parent = spec.parent; parent !== undefined; parent = groupById.get(parent)?.parent) depth++;
      return depth;
    };

    const nodes: LayoutNode[] = state.nodes.map((spec) => {
      const path: string[] = [];
      for (let group = spec.group; group !== undefined; group = groupById.get(group)?.parent) path.unshift(group);
      const centre = placement.nodes.get(spec.id);
      const card = cards.get(spec.id)!;
      if (!centre) throw new Error(`layout lost node "${spec.id}"`);
      return {
        id: spec.id,
        spec,
        x: centre.x,
        y: centre.y,
        width: card.width,
        height: card.height,
        shape: spec.shape ?? shapeForKind(spec.kind),
        color: spec.color ?? 'tx2',
        path,
      };
    });

    const edges: LayoutEdge[] = state.edges.map((spec) => {
      const id = edgeId(spec);
      const route = placement.edges.get(id);
      if (!route) throw new Error(`layout lost edge "${id}"`);
      return { id, spec, color: spec.color ?? 'tx3', points: route.points, label: route.label };
    });

    const groups: LayoutGroup[] = state.groups
      .map((spec) => {
        const box = placement.groups.get(spec.id);
        if (!box) throw new Error(`layout lost group "${spec.id}"`);
        return { id: spec.id, spec, depth: depthOf(spec), color: spec.color ?? 'tx3', box, legend: null as Box | null };
      })
      .sort((a, b) => a.depth - b.depth);
    const blocked: string[] = [];
    for (const group of groups) {
      const placed = placeLegend(group, groupLabels.get(group.id), edges);
      group.legend = placed?.box ?? null;
      if (placed && !placed.clear) blocked.push(group.id);
    }

    return { layout: { width: placement.width, height: placement.height, nodes, edges, groups }, blocked };
  }
}

/**
 * The legend sits on the panel's top border, where edges entering the group
 * cross it. It starts at the left and slides right past any crossing; a
 * border too crowded for that puts it on the bottom border instead, where
 * only edges leaving the group cross. No edge runs through a title.
 */
function placeLegend(group: LayoutGroup, size: Size | undefined, edges: LayoutEdge[]): { box: Box; clear: boolean } | null {
  if (!size) return null;
  const { box } = group;
  const start = box.x + GROUP_LABEL_X - GROUP_LABEL_PAD;
  const limit = box.x + box.width - GROUP_LABEL_PAD;

  for (const y of [box.y, box.y + box.height]) {
    const spans: [number, number][] = [];
    for (const edge of edges) {
      for (let i = 1; i < edge.points.length; i++) {
        const a = edge.points[i - 1];
        const b = edge.points[i];
        if (Math.min(a.y, b.y) <= y + size.height / 2 && Math.max(a.y, b.y) >= y - size.height / 2) {
          spans.push([Math.min(a.x, b.x) - LEGEND_CLEARANCE, Math.max(a.x, b.x) + LEGEND_CLEARANCE]);
        }
      }
    }
    spans.sort((a, b) => a[0] - b[0]);

    let x = start;
    for (const [from, to] of spans) {
      if (to < x || from > x + size.width) continue;
      x = to;
    }
    if (x + size.width <= limit) return { box: { x, y: y - size.height / 2, width: size.width, height: size.height }, clear: true };
  }

  // Nowhere clear on either border: keep the conventional spot for now.
  return { box: { x: start, y: box.y - size.height / 2, width: size.width, height: size.height }, clear: false };
}
