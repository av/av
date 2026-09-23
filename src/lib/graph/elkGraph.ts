import type { ElkEdgeSection, ElkExtendedEdge, ElkLabel, ElkNode, LayoutOptions } from 'elkjs/lib/elk-api';

import type { GraphState } from './types';

/**
 * Translation between a graph state and ELK's layered layout. Pure: no DOM,
 * no ELK instance, so the same code runs in the page and in Node checks.
 */

export type Direction = 'RIGHT' | 'DOWN';

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ElkInput {
  state: GraphState;
  direction: Direction;
  /** Card size per node id. */
  cards: Map<string, Size>;
  /** Plate size per edge id; edges without a label are absent. */
  edgeLabels: Map<string, Size>;
  /** Legend plate size per group id; groups without a label are absent. */
  groupLabels: Map<string, Size>;
  edgeId: (edge: GraphState['edges'][number]) => string;
  /**
   * How strongly one sibling feeds another across the whole story (see
   * `storyAffinity`). Ordering by the story rather than by the step keeps
   * groups from swapping places whenever an edge comes or goes.
   */
  affinity?: Affinity;
  /** Groups whose contents must start right of their legend, because edges crossed it. */
  legendRoom?: Set<string>;
}

/** Edge count between two siblings, keyed `from → to`. */
export type Affinity = Map<string, number>;

const affinityKey = (from: string, to: string) => `${from}\u2192${to}`;

interface SiblingLink {
  edge: GraphState['edges'][number];
  id: string;
  /** Lowest container holding both ends; undefined is the root. */
  container: string | undefined;
  /** The two children of that container the edge runs between. */
  from: string;
  to: string;
}

/** Where each edge lives, and which two children of that container it joins. */
function siblingLinks(state: GraphState, edgeId: ElkInput['edgeId']): SiblingLink[] {
  const groupIds = new Set(state.groups.map((g) => g.id));
  const parentOf = new Map<string, string | undefined>();
  for (const group of state.groups) parentOf.set(group.id, group.parent !== undefined && groupIds.has(group.parent) ? group.parent : undefined);
  for (const node of state.nodes) parentOf.set(node.id, node.group !== undefined && groupIds.has(node.group) ? node.group : undefined);

  const chain = (id: string): (string | undefined)[] => {
    const path: (string | undefined)[] = [id];
    for (let current = parentOf.get(id); current !== undefined; current = parentOf.get(current)) path.unshift(current);
    path.unshift(undefined);
    return path;
  };

  return state.edges.map((edge) => {
    const a = chain(edge.from);
    const b = chain(edge.to);
    let depth = 0;
    while (depth + 1 < Math.min(a.length, b.length) && a[depth + 1] === b[depth + 1]) depth++;
    return { edge, id: edgeId(edge), container: a[depth], from: a[depth + 1]!, to: b[depth + 1]! };
  });
}

/**
 * Counts, over every step of a story, the distinct edges running from one
 * sibling to another. Two groups that trade places depending on which edges
 * a step happens to show would make the diagram jump; ordering by the whole
 * story's traffic keeps them where the story as a whole wants them.
 */
export function storyAffinity(states: GraphState[], edgeId: ElkInput['edgeId']): Affinity {
  const seen = new Map<string, Set<string>>();
  for (const state of states) {
    for (const link of siblingLinks(state, edgeId)) {
      if (link.from === link.to) continue;
      const key = affinityKey(link.from, link.to);
      const ids = seen.get(key) ?? new Set<string>();
      ids.add(link.id);
      seen.set(key, ids);
    }
  }
  return new Map([...seen].map(([key, ids]) => [key, ids.size]));
}

export interface ElkPlacement {
  /** Card centres. */
  nodes: Map<string, Point>;
  groups: Map<string, Rect>;
  edges: Map<string, { points: Point[]; label: Rect | null }>;
  width: number;
  height: number;
}

/** Clear space between two cards in the same layer. */
const NODE_GAP = 30;
/** Clear space between layers; routed edges run in this gap. */
const LAYER_GAP = 56;
/** Spacing between parallel edge runs, and between a run and a card. */
const EDGE_GAP = 14;
const EDGE_NODE_GAP = 16;
const GROUP_PADDING = 18;
/** Extra room under a group's top border, where its legend plate sits. */
const GROUP_TITLE_PAD = 12;

const ROOT_OPTIONS: LayoutOptions = {
  'elk.algorithm': 'layered',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.randomSeed': '7',
  'elk.json.edgeCoords': 'ROOT',
  'elk.json.shapeCoords': 'ROOT',
  'elk.padding': '[top=20,left=20,bottom=20,right=20]',
  'elk.spacing.nodeNode': String(NODE_GAP),
  'elk.layered.spacing.nodeNodeBetweenLayers': String(LAYER_GAP),
  'elk.spacing.edgeEdge': String(EDGE_GAP),
  'elk.spacing.edgeNode': String(EDGE_NODE_GAP),
  'elk.layered.spacing.edgeEdgeBetweenLayers': String(EDGE_GAP),
  'elk.layered.spacing.edgeNodeBetweenLayers': String(EDGE_NODE_GAP),
  'elk.spacing.edgeLabel': '4',
  'elk.spacing.componentComponent': String(LAYER_GAP),
  'elk.edgeLabels.placement': 'CENTER',
  'elk.layered.edgeLabels.sideSelection': 'SMART_DOWN',
  // The order objects were added in is the order they are drawn in: a new
  // node slots in beside the ones it arrived after instead of reshuffling.
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
  'elk.layered.crossingMinimization.forceNodeModelOrder': 'false',
  // Longest-path layering puts every source on the top layer, so sibling
  // groups fed from the same place sit side by side instead of stacking.
  'elk.layered.layering.strategy': 'LONGEST_PATH',
  'elk.layered.thoroughness': '30',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.layered.nodePlacement.favorStraightEdges': 'true',
  'elk.layered.unnecessaryBendpoints': 'false',
  // Merging edges into shared trunks reads as a bundle but stacks dashed,
  // solid and flow lines on top of each other; packed lanes stay legible.
  'elk.layered.mergeEdges': 'false',
  'elk.separateConnectedComponents': 'false',
};

const GROUP_OPTIONS: LayoutOptions = {
  'elk.padding': `[top=${GROUP_PADDING + GROUP_TITLE_PAD},left=${GROUP_PADDING},bottom=${GROUP_PADDING},right=${GROUP_PADDING}]`,
};

export function buildElkGraph(input: ElkInput): { graph: ElkNode; reversed: Set<string> } {
  const { state, direction, cards, edgeLabels, groupLabels, edgeId, affinity, legendRoom } = input;
  const root: ElkNode = { id: '__root', layoutOptions: { ...ROOT_OPTIONS, 'elk.direction': direction }, children: [], edges: [] };
  const containers = new Map<string | undefined, ElkNode>([[undefined, root]]);

  // Groups are created before nodes so members can be attached to them; a
  // group whose parent comes later in the list is attached once it exists.
  const pending = [...state.groups];
  for (const group of pending) containers.set(group.id, { id: group.id, children: [], edges: [] });
  for (const group of pending) {
    const elk = containers.get(group.id)!;
    const label = groupLabels.get(group.id);
    // The legend sits on the top border, so the panel must be at least that
    // wide; when edges crossed it, the contents move clear of it altogether.
    const left = GROUP_PADDING + (label && legendRoom?.has(group.id) ? label.width : 0);
    elk.layoutOptions = {
      ...GROUP_OPTIONS,
      'elk.padding': `[top=${GROUP_PADDING + GROUP_TITLE_PAD},left=${left},bottom=${GROUP_PADDING},right=${GROUP_PADDING}]`,
      'elk.nodeSize.constraints': '[MINIMUM_SIZE]',
      'elk.nodeSize.minimum': `(${label ? label.width + 40 : 0}, 0)`,
    };
    const parent = group.parent !== undefined && containers.has(group.parent) ? group.parent : undefined;
    containers.get(parent)!.children!.push(elk);
  }

  for (const node of state.nodes) {
    const size = cards.get(node.id);
    if (!size) throw new Error(`no card size for node "${node.id}"`);
    const parent = node.group !== undefined && containers.has(node.group) ? node.group : undefined;
    containers.get(parent)!.children!.push({ id: node.id, width: size.width, height: size.height });
  }

  // ELK wants each edge in the lowest container that holds both ends.
  const placed = siblingLinks(state, edgeId);

  // An edge that runs backwards between two sibling groups has to leave the
  // first group through its far side and loop around everything in between.
  // Ordering each container's children to minimise backward edges, and laying
  // the remaining ones out reversed, keeps every route short and forward.
  const reversed = new Set<string>();
  for (const [containerId, container] of containers) {
    const siblings = container.children!.map((child) => child.id);
    const links = placed.filter((p) => p.container === containerId && p.from !== p.to);
    const weight = (from: string, to: string) =>
      affinity?.get(affinityKey(from, to)) ?? links.filter((l) => l.from === from && l.to === to).length;
    const rank = new Map(feedbackOrder(siblings, weight).map((id, index) => [id, index]));
    container.children!.sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
    for (const link of links) if (rank.get(link.from)! > rank.get(link.to)!) reversed.add(link.id);
  }

  for (const { edge, id, container } of placed) {
    const flip = reversed.has(id);
    const elkEdge: ElkExtendedEdge = { id, sources: [flip ? edge.to : edge.from], targets: [flip ? edge.from : edge.to] };
    const label = edgeLabels.get(id);
    if (label) elkEdge.labels = [{ id: `${id}::label`, text: edge.label ?? '', width: label.width, height: label.height }];
    containers.get(container)!.edges!.push(elkEdge);
  }

  return { graph: root, reversed };
}

/**
 * Greedy feedback-arc-set ordering (Eades, Lin & Smyth): sinks go last,
 * sources first, otherwise the node with the most surplus outflow. Ties keep
 * model order, so the result is deterministic and stable as edges are added.
 */
function feedbackOrder(ids: string[], weight: (from: string, to: string) => number): string[] {
  const remaining = new Set(ids);
  const degree = (id: string, out: boolean) => {
    let total = 0;
    for (const other of remaining) if (other !== id) total += out ? weight(id, other) : weight(other, id);
    return total;
  };
  const head: string[] = [];
  const tail: string[] = [];

  while (remaining.size > 0) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of ids) {
        if (!remaining.has(id)) continue;
        if (degree(id, true) === 0 && degree(id, false) > 0) {
          tail.unshift(id);
          remaining.delete(id);
          changed = true;
        } else if (degree(id, false) === 0 && degree(id, true) > 0) {
          head.push(id);
          remaining.delete(id);
          changed = true;
        }
      }
    }
    if (remaining.size === 0) break;

    // Unconnected children keep their model order; everyone else is on a cycle.
    let best: string | null = null;
    let bestScore = -Infinity;
    for (const id of ids) {
      if (!remaining.has(id)) continue;
      const score = degree(id, true) - degree(id, false);
      if (score > bestScore) {
        best = id;
        bestScore = score;
      }
    }
    head.push(best!);
    remaining.delete(best!);
  }

  return [...head, ...tail];
}

/** Reads positions back out; `reversed` edges were laid out backwards and are flipped back here. */
export function readElkLayout(root: ElkNode, groupIds: Set<string>, reversed: Set<string>): ElkPlacement {
  const nodes = new Map<string, Point>();
  const groups = new Map<string, Rect>();
  const edges = new Map<string, { points: Point[]; label: Rect | null }>();

  const visit = (node: ElkNode) => {
    for (const child of node.children ?? []) {
      const rect = { x: child.x ?? 0, y: child.y ?? 0, width: child.width ?? 0, height: child.height ?? 0 };
      if (groupIds.has(child.id)) groups.set(child.id, rect);
      else nodes.set(child.id, { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });
      visit(child);
    }
    for (const edge of node.edges ?? []) {
      const points: Point[] = [];
      for (const section of orderSections(edge.sections ?? [])) {
        const run = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
        for (const p of run) {
          const last = points[points.length - 1];
          if (!last || Math.abs(last.x - p.x) > 0.01 || Math.abs(last.y - p.y) > 0.01) points.push({ x: p.x, y: p.y });
        }
      }
      squareUp(points);
      if (reversed.has(edge.id)) points.reverse();
      const label: ElkLabel | undefined = edge.labels?.[0];
      edges.set(edge.id, {
        points,
        label: label ? { x: label.x ?? 0, y: label.y ?? 0, width: label.width ?? 0, height: label.height ?? 0 } : null,
      });
    }
  };
  visit(root);

  return { nodes, groups, edges, width: root.width ?? 0, height: root.height ?? 0 };
}

/** Sections of a split edge, in path order (ELK does not promise array order). */
function orderSections(sections: ElkEdgeSection[]): ElkEdgeSection[] {
  if (sections.length < 2) return sections;
  const byId = new Map(sections.map((section) => [section.id, section]));
  let current = sections.find((section) => !section.incomingSections?.some((id) => byId.has(id))) ?? sections[0];
  const ordered: ElkEdgeSection[] = [];
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    ordered.push(current);
    seen.add(current.id);
    current = byId.get(current.outgoingSections?.find((id) => byId.has(id)) ?? '')!;
  }
  // Anything not reachable (should not happen) keeps its place after the chain.
  return [...ordered, ...sections.filter((section) => !seen.has(section.id))];
}

/**
 * ELK can leave sub-pixel jogs where a route crosses a group border. Snapping
 * them, walking back from the target, keeps every segment horizontal or
 * vertical; a point on a card border only slides along that border.
 */
function squareUp(points: Point[]): void {
  for (let i = points.length - 1; i > 0; i--) {
    const a = points[i - 1];
    const b = points[i];
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    if (dx > 0 && dx < 1 && dy >= 1) a.x = b.x;
    else if (dy > 0 && dy < 1 && dx >= 1) a.y = b.y;
  }
}
