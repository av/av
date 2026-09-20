import * as d3 from 'd3';

import { edgeId } from './story';
import type { Accent, EdgeSpec, GraphState, GroupSpec, NodeShape, NodeSpec } from './types';

export const STAGE_WIDTH = 1000;
export const BASE_RADIUS = 24;

const CLUSTER_PULL = 0.16;
const ROOT_PULL = 0.03;
const CHARGE = -240;
const LINK_DISTANCE = 70;
const COLLIDE_PADDING = 22;
const GROUP_PADDING = 18;
const GROUP_LABEL_HEIGHT = 20;
const NODE_LABEL_HEIGHT = 18;
const STAGE_MARGIN = 36;

export interface LayoutNode extends d3.SimulationNodeDatum {
  id: string;
  spec: NodeSpec;
  x: number;
  y: number;
  /** Position currently painted on screen; tweens converge on `x`/`y`. */
  px: number;
  py: number;
  /** False until the node has been given a starting position. */
  placed: boolean;
  r: number;
  shape: NodeShape;
  color: Accent;
  /** Outermost-first chain of group ids. */
  path: string[];
}

export interface LayoutEdge extends d3.SimulationLinkDatum<LayoutNode> {
  id: string;
  spec: EdgeSpec;
  source: LayoutNode;
  target: LayoutNode;
  color: Accent;
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
  anchor: { x: number; y: number };
}

export interface Layout {
  width: number;
  height: number;
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  groups: LayoutGroup[];
}

const KIND_SHAPES: Record<string, NodeShape> = {
  machine: 'rect',
  service: 'pill',
  agent: 'circle',
  human: 'circle',
  skill: 'diamond',
  repo: 'hex',
};

export function shapeForKind(kind: string | undefined): NodeShape {
  return (kind && KIND_SHAPES[kind]) || 'circle';
}

function hashUnit(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function seededRandom(seed: string): () => number {
  let a = Math.floor(hashUnit(seed) * 4294967296) || 1;
  return () => {
    a ^= a << 13;
    a ^= a >>> 17;
    a ^= a << 5;
    return (a >>> 0) / 4294967296;
  };
}

/**
 * Incremental force layout. Keeps node objects (and therefore positions)
 * between calls so consecutive states animate from where they were.
 */
export default class GraphLayout {
  readonly width = STAGE_WIDTH;
  readonly height: number;

  private readonly nodes = new Map<string, LayoutNode>();
  private readonly random: () => number;
  private first = true;

  constructor(aspect: number, seed: string) {
    this.height = Math.round(STAGE_WIDTH / aspect);
    this.random = seededRandom(seed);
  }

  compute(state: GraphState): Layout {
    const groups = this.buildGroups(state.groups);
    const groupById = new Map(groups.map((g) => [g.id, g]));
    const nodes = this.syncNodes(state.nodes, groupById);
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const edges: LayoutEdge[] = state.edges.map((spec) => {
      const source = nodeById.get(spec.from);
      const target = nodeById.get(spec.to);
      if (!source || !target) throw new Error(`edge references unknown node: ${edgeId(spec)}`);
      return { id: edgeId(spec), spec, source, target, color: spec.color ?? 'tx3' };
    });

    this.assignAnchors(groups, nodes);
    this.simulate(nodes, edges, groups);
    this.measureGroups(groups, nodes);

    this.first = false;
    return { width: this.width, height: this.height, nodes, edges, groups };
  }

  private buildGroups(specs: GroupSpec[]): LayoutGroup[] {
    const byId = new Map(specs.map((spec) => [spec.id, spec]));
    const depthOf = (spec: GroupSpec): number => {
      let depth = 0;
      let parent = spec.parent;
      while (parent !== undefined) {
        depth++;
        parent = byId.get(parent)?.parent;
      }
      return depth;
    };

    return specs
      .map((spec) => ({
        id: spec.id,
        spec,
        depth: depthOf(spec),
        color: spec.color ?? 'tx3',
        box: { x: 0, y: 0, width: 0, height: 0 },
        anchor: { x: this.width / 2, y: this.height / 2 },
      }))
      .sort((a, b) => a.depth - b.depth);
  }

  private syncNodes(specs: NodeSpec[], groups: Map<string, LayoutGroup>): LayoutNode[] {
    const alive = new Set(specs.map((spec) => spec.id));
    for (const id of this.nodes.keys()) {
      if (!alive.has(id)) this.nodes.delete(id);
    }

    return specs.map((spec) => {
      const path: string[] = [];
      let groupId = spec.group;
      while (groupId !== undefined) {
        path.unshift(groupId);
        groupId = groups.get(groupId)?.spec.parent;
      }

      const r = BASE_RADIUS * (spec.size ?? 1);
      const existing = this.nodes.get(spec.id);

      if (existing) {
        existing.spec = spec;
        existing.r = r;
        existing.shape = spec.shape ?? shapeForKind(spec.kind);
        existing.color = spec.color ?? 'tx2';
        existing.path = path;
        return existing;
      }

      const node: LayoutNode = {
        id: spec.id,
        spec,
        x: 0,
        y: 0,
        px: 0,
        py: 0,
        r,
        shape: spec.shape ?? shapeForKind(spec.kind),
        color: spec.color ?? 'tx2',
        path,
        placed: false,
      };
      this.nodes.set(spec.id, node);
      return node;
    });
  }

  private assignAnchors(groups: LayoutGroup[], nodes: LayoutNode[]): void {
    const { width, height } = this;
    const topLevel = groups.filter((g) => g.spec.parent === undefined);
    const hasLooseNodes = nodes.some((n) => n.path.length === 0 && n.spec.x === undefined);
    const slots = topLevel.length + (hasLooseNodes ? 1 : 0);
    const columns = slots <= 3 ? slots : Math.ceil(slots / 2);
    const rows = Math.ceil(slots / columns) || 1;

    const slotAt = (index: number) => ({
      x: (width * (index % columns + 1)) / (columns + 1),
      y: (height * (Math.floor(index / columns) + 1)) / (rows + 1),
    });

    // Loose nodes take the last slot so groups fill from the left.
    topLevel.forEach((group, index) => {
      group.anchor = this.explicitAnchor(group.spec) ?? slotAt(index);
    });
    this.looseAnchor = hasLooseNodes ? slotAt(slots - 1) : { x: width / 2, y: height / 2 };

    // Nested groups fan out horizontally under their parent's anchor. A parent
    // with direct members of its own reserves the last slot for them.
    this.directAnchors.clear();
    for (const parent of groups) {
      const children = groups.filter((g) => g.spec.parent === parent.id);
      if (children.length === 0) continue;
      const hasDirect = nodes.some((n) => n.path[n.path.length - 1] === parent.id);
      const slots = children.length + (hasDirect ? 1 : 0);
      const spread = 170;
      const slotX = (index: number) => parent.anchor.x + (index - (slots - 1) / 2) * spread;

      children.forEach((child, index) => {
        child.anchor = this.explicitAnchor(child.spec) ?? { x: slotX(index), y: parent.anchor.y + 10 };
      });
      if (hasDirect) this.directAnchors.set(parent.id, { x: slotX(slots - 1), y: parent.anchor.y });
    }
  }

  private looseAnchor = { x: STAGE_WIDTH / 2, y: STAGE_WIDTH / 2 };
  /** Anchors for nodes that sit directly in a group that also has child groups. */
  private readonly directAnchors = new Map<string, { x: number; y: number }>();

  private explicitAnchor(spec: { x?: number; y?: number }): { x: number; y: number } | null {
    if (spec.x === undefined || spec.y === undefined) return null;
    return { x: (spec.x / 100) * this.width, y: (spec.y / 100) * this.height };
  }

  private anchorFor(node: LayoutNode, groups: Map<string, LayoutGroup>): { x: number; y: number } {
    const innermost = node.path[node.path.length - 1];
    const group = innermost !== undefined ? groups.get(innermost) : undefined;
    if (!group) return this.looseAnchor;
    return this.directAnchors.get(group.id) ?? group.anchor;
  }

  private simulate(nodes: LayoutNode[], edges: LayoutEdge[], groupList: LayoutGroup[]): void {
    const groups = new Map(groupList.map((g) => [g.id, g]));
    const { width, height } = this;

    for (const node of nodes) {
      const pinned = this.explicitAnchor(node.spec);
      if (pinned) {
        node.fx = pinned.x;
        node.fy = pinned.y;
      } else {
        node.fx = undefined;
        node.fy = undefined;
      }

      if (!node.placed) {
        const anchor = pinned ?? this.seedPosition(node, edges, groups);
        node.x = anchor.x;
        node.y = anchor.y;
        node.px = anchor.x;
        node.py = anchor.y;
        node.placed = true;
      }
    }

    const sameCluster = (a: LayoutNode, b: LayoutNode) => a.path[0] !== undefined && a.path[0] === b.path[0];
    const pullStrength = (node: LayoutNode) => (node.path.length > 0 ? CLUSTER_PULL : ROOT_PULL);

    const simulation = d3
      .forceSimulation<LayoutNode>(nodes)
      .randomSource(this.random)
      .force(
        'link',
        d3
          .forceLink<LayoutNode, LayoutEdge>(edges)
          .id((n) => n.id)
          .distance((e) => e.source.r + e.target.r + LINK_DISTANCE)
          .strength((e) => (sameCluster(e.source, e.target) ? 0.5 : 0.04)),
      )
      .force('charge', d3.forceManyBody<LayoutNode>().strength(CHARGE).distanceMax(280))
      .force('collide', d3.forceCollide<LayoutNode>().radius((n) => n.r + COLLIDE_PADDING).iterations(2))
      .force('x', d3.forceX<LayoutNode>((n) => this.anchorFor(n, groups).x).strength(pullStrength))
      .force('y', d3.forceY<LayoutNode>((n) => this.anchorFor(n, groups).y).strength(pullStrength))
      .force('separate', groupSeparation(nodes, groupList))
      .force('bounds', (alpha) => {
        for (const node of nodes) {
          const pad = node.r + STAGE_MARGIN;
          node.x = Math.max(pad, Math.min(width - pad, node.x));
          node.y = Math.max(pad, Math.min(height - pad - NODE_LABEL_HEIGHT, node.y));
          void alpha;
        }
      })
      .stop();

    simulation.alpha(this.first ? 1 : 0.7).alphaMin(0.001);
    simulation.tick(this.first ? 300 : 220);

    for (const node of nodes) {
      const pinned = this.explicitAnchor(node.spec);
      if (pinned) {
        node.x = pinned.x;
        node.y = pinned.y;
      }
      node.vx = 0;
      node.vy = 0;
    }
  }

  /** New nodes appear next to a neighbour that already exists, else at their anchor. */
  private seedPosition(node: LayoutNode, edges: LayoutEdge[], groups: Map<string, LayoutGroup>): { x: number; y: number } {
    const jitter = () => (hashUnit(node.id + this.random()) - 0.5) * 60;
    const neighbour = edges
      .filter((e) => e.source === node || e.target === node)
      .map((e) => (e.source === node ? e.target : e.source))
      .find((other) => other.placed);

    const base = neighbour && node.path.length === 0 ? { x: neighbour.x, y: neighbour.y } : this.anchorFor(node, groups);
    return { x: base.x + jitter(), y: base.y + jitter() };
  }

  private measureGroups(groups: LayoutGroup[], nodes: LayoutNode[]): void {
    // Deepest first so parents can wrap their children's boxes.
    const ordered = [...groups].sort((a, b) => b.depth - a.depth);
    const boxes = new Map<string, Box>();

    for (const group of ordered) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      const extend = (x0: number, y0: number, x1: number, y1: number) => {
        minX = Math.min(minX, x0);
        minY = Math.min(minY, y0);
        maxX = Math.max(maxX, x1);
        maxY = Math.max(maxY, y1);
      };

      for (const node of nodes) {
        if (node.path[node.path.length - 1] === group.id) {
          extend(node.x - node.r, node.y - node.r, node.x + node.r, node.y + node.r + NODE_LABEL_HEIGHT);
        }
      }
      for (const child of groups) {
        const childBox = child.spec.parent === group.id ? boxes.get(child.id) : undefined;
        if (childBox) extend(childBox.x, childBox.y, childBox.x + childBox.width, childBox.y + childBox.height);
      }

      if (minX === Infinity) {
        extend(group.anchor.x - 40, group.anchor.y - 24, group.anchor.x + 40, group.anchor.y + 24);
      }

      const labelPad = group.spec.label ? GROUP_LABEL_HEIGHT : 0;
      const box: Box = {
        x: minX - GROUP_PADDING,
        y: minY - GROUP_PADDING - labelPad,
        width: maxX - minX + GROUP_PADDING * 2,
        height: maxY - minY + GROUP_PADDING * 2 + labelPad,
      };
      boxes.set(group.id, box);
      group.box = box;
    }
  }
}

/**
 * Pushes sibling clusters apart when their bounding boxes overlap, so groups
 * read as distinct regions instead of interleaving. Under each parent (or the
 * stage root) the clusters are its child groups plus its direct member nodes.
 */
function groupSeparation(nodes: LayoutNode[], groups: LayoutGroup[]): d3.Force<LayoutNode, undefined> {
  const clustersByParent = new Map<string | undefined, LayoutNode[][]>();
  const push = (parent: string | undefined, members: LayoutNode[]) => {
    if (members.length === 0) return;
    const list = clustersByParent.get(parent) ?? [];
    list.push(members);
    clustersByParent.set(parent, list);
  };

  for (const group of groups) {
    push(group.spec.parent, nodes.filter((n) => n.path.includes(group.id)));
  }
  for (const group of groups) {
    push(group.id, nodes.filter((n) => n.path[n.path.length - 1] === group.id));
  }
  push(undefined, nodes.filter((n) => n.path.length === 0));

  const pairs: [LayoutNode[], LayoutNode[]][] = [];
  for (const clusters of clustersByParent.values()) {
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) pairs.push([clusters[i], clusters[j]]);
    }
  }

  const bounds = (members: LayoutNode[]) => {
    const pad = members.length > 1 ? GROUP_PADDING : 4;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of members) {
      x0 = Math.min(x0, n.x - n.r - pad);
      y0 = Math.min(y0, n.y - n.r - pad);
      x1 = Math.max(x1, n.x + n.r + pad);
      y1 = Math.max(y1, n.y + n.r + pad + NODE_LABEL_HEIGHT);
    }
    return { x0, y0, x1, y1 };
  };

  return (alpha) => {
    for (const [a, b] of pairs) {
      const ba = bounds(a);
      const bb = bounds(b);
      const overlapX = Math.min(ba.x1, bb.x1) - Math.max(ba.x0, bb.x0);
      const overlapY = Math.min(ba.y1, bb.y1) - Math.max(ba.y0, bb.y0);
      if (overlapX <= 0 || overlapY <= 0) continue;

      const centreA = { x: (ba.x0 + ba.x1) / 2, y: (ba.y0 + ba.y1) / 2 };
      const centreB = { x: (bb.x0 + bb.x1) / 2, y: (bb.y0 + bb.y1) / 2 };
      const horizontal = overlapX < overlapY;
      const sign = horizontal ? Math.sign(centreB.x - centreA.x) || 1 : Math.sign(centreB.y - centreA.y) || 1;
      const shove = (horizontal ? overlapX : overlapY) * 0.5 * alpha;

      for (const n of a) {
        if (horizontal) n.vx = (n.vx ?? 0) - shove * sign;
        else n.vy = (n.vy ?? 0) - shove * sign;
      }
      for (const n of b) {
        if (horizontal) n.vx = (n.vx ?? 0) + shove * sign;
        else n.vy = (n.vy ?? 0) + shove * sign;
      }
    }
  };
}
