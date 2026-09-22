import * as d3 from 'd3';

import { measureCard } from './shapes';
import { edgeId } from './story';
import type { Accent, EdgeSpec, GraphState, GroupSpec, NodeShape, NodeSpec } from './types';

export const STAGE_WIDTH = 1500;

const CLUSTER_PULL = 0.16;
const ROOT_PULL = 0.03;
/** Pull of an unchanged node toward where it was in the previous step. */
const INERTIA = 0.35;
const TICKS = 320;
const NESTED_SPREAD = 170;
const CHARGE = -260;
const LINK_DISTANCE = 64;
/** Clear space kept between two cards. */
const CARD_GAP = 26;
const GROUP_PADDING = 20;
const GROUP_LABEL_HEIGHT = 6;
const STAGE_MARGIN = 30;

export interface LayoutNode extends d3.SimulationNodeDatum {
  id: string;
  spec: NodeSpec;
  x: number;
  y: number;
  /** False until the node has been given a starting position. */
  placed: boolean;
  /** True when the node changed group in this step (it may travel far). */
  moved: boolean;
  /** Where the node was before this step; unchanged nodes are held near it. */
  homeX: number;
  homeY: number;
  /** Card size, already scaled by the spec's `size` multiplier. */
  width: number;
  height: number;
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

/** Bounding box of a set of nodes and groups (all of them when the sets are empty). */
export function boundsOf(layout: Layout, nodeIds?: Set<string>, groupIds?: Set<string>): Box | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const all = !nodeIds && !groupIds;
  for (const n of layout.nodes) {
    if (!all && !nodeIds?.has(n.id)) continue;
    x0 = Math.min(x0, n.x - n.width / 2);
    y0 = Math.min(y0, n.y - n.height / 2);
    x1 = Math.max(x1, n.x + n.width / 2);
    y1 = Math.max(y1, n.y + n.height / 2);
  }
  for (const g of layout.groups) {
    if (!all && !groupIds?.has(g.id)) continue;
    x0 = Math.min(x0, g.box.x);
    y0 = Math.min(y0, g.box.y);
    x1 = Math.max(x1, g.box.x + g.box.width);
    y1 = Math.max(y1, g.box.y + g.box.height);
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
    this.carryGroups(groups, nodes);
    this.simulate(nodes, edges, groups);
    this.measureGroups(groups, nodes);

    this.first = false;
    return this.snapshot(nodes, edges, groups);
  }

  /**
   * The simulation keeps mutating its node objects across steps, so each step
   * hands out an immutable copy. Replaying or jumping between steps therefore
   * always renders exactly the geometry that was computed for that step.
   */
  private snapshot(nodes: LayoutNode[], edges: LayoutEdge[], groups: LayoutGroup[]): Layout {
    const copies = new Map<string, LayoutNode>();
    const nodeCopies = nodes.map((node) => {
      const copy: LayoutNode = {
        id: node.id,
        spec: node.spec,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        shape: node.shape,
        color: node.color,
        path: [...node.path],
        placed: true,
        moved: false,
        homeX: node.homeX,
        homeY: node.homeY,
      };
      copies.set(node.id, copy);
      return copy;
    });
    const edgeCopies = edges.map((edge) => ({
      ...edge,
      source: copies.get(edge.source.id) ?? edge.source,
      target: copies.get(edge.target.id) ?? edge.target,
    }));
    const groupCopies = groups.map((group) => ({ ...group, box: { ...group.box }, anchor: { ...group.anchor } }));

    return { width: this.width, height: this.height, nodes: nodeCopies, edges: edgeCopies, groups: groupCopies };
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

      const scale = spec.size ?? 1;
      const card = measureCard(spec.label ?? spec.id, spec.sublabel ?? '');
      const width = card.width * scale;
      const height = card.height * scale;
      const existing = this.nodes.get(spec.id);

      if (existing) {
        existing.spec = spec;
        existing.width = width;
        existing.height = height;
        existing.shape = spec.shape ?? shapeForKind(spec.kind);
        existing.color = spec.color ?? 'tx2';
        // Only a change of the innermost group counts as a move; a re-parented
        // group carries its members along as one body instead.
        existing.moved = existing.path[existing.path.length - 1] !== path[path.length - 1];
        existing.path = path;
        existing.homeX = existing.x;
        existing.homeY = existing.y;
        return existing;
      }

      const node: LayoutNode = {
        id: spec.id,
        spec,
        x: 0,
        y: 0,
        width,
        height,
        shape: spec.shape ?? shapeForKind(spec.kind),
        color: spec.color ?? 'tx2',
        path,
        placed: false,
        moved: false,
        homeX: 0,
        homeY: 0,
      };
      this.nodes.set(spec.id, node);
      return node;
    });
  }

  private assignAnchors(groups: LayoutGroup[], nodes: LayoutNode[]): void {
    const { width, height } = this;
    const deltas = new Map<string, { x: number; y: number }>();
    const taken: { x: number; y: number }[] = nodes
      .filter((n) => n.spec.x !== undefined && n.spec.y !== undefined)
      .map((n) => this.explicitAnchor(n.spec) ?? { x: 0, y: 0 });

    // Groups are sorted by depth, so parents are resolved before children.
    for (const group of groups) {
      const previous = this.previousAnchors.get(group.id);
      const parent = group.spec.parent !== undefined ? groups.find((g) => g.id === group.spec.parent) : undefined;
      const parentDelta = parent ? deltas.get(parent.id) : undefined;
      const explicit = this.explicitAnchor(group.spec);

      if (explicit) {
        group.anchor = explicit;
      } else if (previous) {
        // Existing groups stay where they were, following a moving parent.
        group.anchor = parentDelta ? { x: previous.x + parentDelta.x, y: previous.y + parentDelta.y } : previous;
      } else if (parent) {
        group.anchor = this.nestedSlot(group, parent, groups);
      } else {
        group.anchor = this.freeSlot(taken);
      }

      if (previous) deltas.set(group.id, { x: group.anchor.x - previous.x, y: group.anchor.y - previous.y });
      taken.push(group.anchor);
    }

    this.groupDeltas = deltas;
    this.looseAnchor = { x: width / 2, y: height / 2 };

    // A parent with direct members of its own keeps them beside its children.
    this.directAnchors.clear();
    for (const parent of groups) {
      const children = groups.filter((g) => g.spec.parent === parent.id);
      const hasDirect = nodes.some((n) => n.path[n.path.length - 1] === parent.id);
      if (children.length === 0 || !hasDirect) continue;
      const maxX = Math.max(...children.map((c) => c.anchor.x));
      this.directAnchors.set(parent.id, { x: Math.min(maxX + NESTED_SPREAD, this.width - 140), y: parent.anchor.y });
    }
  }

  /** Anchor for a new nested group: to the right of its existing siblings, else on the parent. */
  private nestedSlot(group: LayoutGroup, parent: LayoutGroup, groups: LayoutGroup[]): { x: number; y: number } {
    const siblings = groups.filter((g) => g.spec.parent === parent.id && g !== group && g.anchor !== undefined);
    const placed = siblings.filter((g) => this.previousAnchors.has(g.id) || this.explicitAnchor(g.spec));
    if (placed.length === 0) return { x: parent.anchor.x, y: parent.anchor.y };
    const maxX = Math.max(...placed.map((g) => g.anchor.x));
    return { x: maxX + NESTED_SPREAD, y: parent.anchor.y };
  }

  /** Anchor for a new top-level group: the candidate point farthest from everything already placed. */
  private freeSlot(taken: { x: number; y: number }[]): { x: number; y: number } {
    const { width, height } = this;
    const columns = [0.22, 0.5, 0.78];
    const rows = [0.27, 0.5, 0.73];
    let best = { x: width / 2, y: height / 2 };
    let bestScore = -Infinity;
    for (const row of rows) {
      for (const column of columns) {
        const candidate = { x: column * width, y: row * height };
        const score = taken.length === 0 ? -Math.hypot(candidate.x - width / 2, candidate.y - height / 2) : Math.min(...taken.map((t) => Math.hypot(t.x - candidate.x, t.y - candidate.y)));
        if (score > bestScore + 0.5) {
          bestScore = score;
          best = candidate;
        }
      }
    }
    return best;
  }

  private looseAnchor = { x: STAGE_WIDTH / 2, y: STAGE_WIDTH / 2 };
  /** Anchors for nodes that sit directly in a group that also has child groups. */
  private readonly directAnchors = new Map<string, { x: number; y: number }>();
  private readonly previousAnchors = new Map<string, { x: number; y: number }>();
  private groupDeltas = new Map<string, { x: number; y: number }>();

  /**
   * When a group's anchor moves between steps, carry its members along so the
   * group travels as one body instead of re-flowing node by node.
   */
  private carryGroups(groups: LayoutGroup[], nodes: LayoutNode[]): void {
    for (const node of nodes) {
      if (!node.placed || node.moved) continue;
      const innermost = node.path[node.path.length - 1];
      const delta = innermost !== undefined ? this.groupDeltas.get(innermost) : undefined;
      if (!delta || Math.abs(delta.x) + Math.abs(delta.y) < 0.5) continue;
      node.x += delta.x;
      node.y += delta.y;
      node.homeX = node.x;
      node.homeY = node.y;
    }

    this.previousAnchors.clear();
    for (const group of groups) this.previousAnchors.set(group.id, { x: group.anchor.x, y: group.anchor.y });
  }

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
        node.homeX = anchor.x;
        node.homeY = anchor.y;
        node.placed = true;
      } else if (node.moved && !pinned) {
        // Re-seed inside the new group so the node settles there instead of
        // being dragged across other clusters by weak forces.
        const anchor = this.anchorFor(node, groups);
        node.x = anchor.x + (hashUnit(node.id) - 0.5) * 50;
        node.y = anchor.y + (hashUnit(`${node.id}:y`) - 0.5) * 50;
        node.homeX = node.x;
        node.homeY = node.y;
      }
    }

    const sameCluster = (a: LayoutNode, b: LayoutNode) => a.path[0] !== undefined && a.path[0] === b.path[0];
    const pullStrength = (node: LayoutNode) => (node.path.length > 0 ? CLUSTER_PULL : ROOT_PULL);
    const inertia = (node: LayoutNode) => (this.first || node.moved ? 0 : INERTIA);

    const simulation = d3
      .forceSimulation<LayoutNode>(nodes)
      .randomSource(this.random)
      .force(
        'link',
        d3
          .forceLink<LayoutNode, LayoutEdge>(edges)
          .id((n) => n.id)
          .distance((e) => (e.source.width + e.target.width) / 2 + LINK_DISTANCE)
          .strength((e) => (sameCluster(e.source, e.target) ? 0.5 : 0.04)),
      )
      .force('charge', d3.forceManyBody<LayoutNode>().strength(CHARGE).distanceMax(320))
      .force('collide', boxCollide(nodes, CARD_GAP))
      .force('x', d3.forceX<LayoutNode>((n) => this.anchorFor(n, groups).x).strength(pullStrength))
      .force('y', d3.forceY<LayoutNode>((n) => this.anchorFor(n, groups).y).strength(pullStrength))
      .force('inertia', rigidInertia(nodes, inertia))
      .force('separate', groupSeparation(nodes, groupList))
      .force('bounds', (alpha) => {
        for (const node of nodes) {
          const padX = node.width / 2 + STAGE_MARGIN;
          const padY = node.height / 2 + STAGE_MARGIN;
          node.x = Math.max(padX, Math.min(width - padX, node.x));
          node.y = Math.max(padY, Math.min(height - padY, node.y));
          void alpha;
        }
      })
      .stop();

    simulation.alpha(this.first ? 1 : 0.6).alphaMin(0.001);
    simulation.tick(TICKS);

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
          extend(node.x - node.width / 2, node.y - node.height / 2, node.x + node.width / 2, node.y + node.height / 2);
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
      x0 = Math.min(x0, n.x - n.width / 2 - pad);
      y0 = Math.min(y0, n.y - n.height / 2 - pad);
      x1 = Math.max(x1, n.x + n.width / 2 + pad);
      y1 = Math.max(y1, n.y + n.height / 2 + pad);
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
      const shove = (horizontal ? overlapX : overlapY) * 0.9 * alpha;

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

/**
 * Holds unchanged nodes in their previous arrangement relative to their
 * cluster, while letting the cluster as a whole translate. Groups therefore
 * keep their internal shape when they are pushed around by other forces.
 */
function rigidInertia(nodes: LayoutNode[], strength: (node: LayoutNode) => number): d3.Force<LayoutNode, undefined> {
  const clusters = new Map<string, LayoutNode[]>();
  for (const node of nodes) {
    if (strength(node) === 0) continue;
    const key = node.path[node.path.length - 1] ?? '';
    const list = clusters.get(key) ?? [];
    list.push(node);
    clusters.set(key, list);
  }

  return (alpha) => {
    for (const members of clusters.values()) {
      let shiftX = 0;
      let shiftY = 0;
      for (const n of members) {
        shiftX += n.x - n.homeX;
        shiftY += n.y - n.homeY;
      }
      shiftX /= members.length;
      shiftY /= members.length;
      for (const n of members) {
        const k = strength(n) * alpha;
        n.vx = (n.vx ?? 0) + (n.homeX + shiftX - n.x) * k;
        n.vy = (n.vy ?? 0) + (n.homeY + shiftY - n.y) * k;
      }
    }
  };
}

/**
 * Keeps cards from overlapping. Circles waste space around wide boxes, so this
 * separates axis-aligned rectangles along whichever axis they overlap least.
 */
function boxCollide(nodes: LayoutNode[], gap: number): d3.Force<LayoutNode, undefined> {
  return (alpha) => {
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const overlapX = (a.width + b.width) / 2 + gap - Math.abs(a.x - b.x);
        if (overlapX <= 0) continue;
        const overlapY = (a.height + b.height) / 2 + gap - Math.abs(a.y - b.y);
        if (overlapY <= 0) continue;

        // Push along the cheaper axis, scaled so wide cards separate sideways.
        const horizontal = overlapX / (a.width + b.width) < overlapY / (a.height + b.height);
        const push = (horizontal ? overlapX : overlapY) * 0.5 * alpha * 2;
        const sign = horizontal ? Math.sign(b.x - a.x) || 1 : Math.sign(b.y - a.y) || 1;

        if (horizontal) {
          a.vx = (a.vx ?? 0) - push * sign;
          b.vx = (b.vx ?? 0) + push * sign;
        } else {
          a.vy = (a.vy ?? 0) - push * sign;
          b.vy = (b.vy ?? 0) + push * sign;
        }
      }
    }
  };
}
