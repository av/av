import type {
  EdgeSpec,
  GraphOp,
  GraphState,
  GraphStorySpec,
  GroupSpec,
  NodeSpec,
  ResolvedStep,
} from './types';

export const edgeId = (edge: EdgeSpec): string => edge.id ?? `${edge.from}->${edge.to}`;

const emptyState = (): GraphState => ({ nodes: [], edges: [], groups: [] });

const cloneState = (state: GraphState): GraphState => ({
  nodes: state.nodes.map((node) => ({ ...node })),
  edges: state.edges.map((edge) => ({ ...edge })),
  groups: state.groups.map((group) => ({ ...group })),
});

class StoryError extends Error {
  constructor(stepIndex: number, message: string) {
    super(`graph story step ${stepIndex}: ${message}`);
    this.name = 'StoryError';
  }
}

function applyOp(state: GraphState, op: GraphOp, stepIndex: number): void {
  const fail = (message: string): never => {
    throw new StoryError(stepIndex, message);
  };
  const findNode = (id: string): NodeSpec => state.nodes.find((n) => n.id === id) ?? fail(`unknown node "${id}"`);
  const findGroup = (id: string): GroupSpec => state.groups.find((g) => g.id === id) ?? fail(`unknown group "${id}"`);
  const findEdge = (id: string): EdgeSpec => state.edges.find((e) => edgeId(e) === id) ?? fail(`unknown edge "${id}"`);

  switch (op.op) {
    case 'add': {
      if ('node' in op) {
        if (state.nodes.some((n) => n.id === op.node.id)) fail(`duplicate node "${op.node.id}"`);
        if (op.node.group !== undefined) findGroup(op.node.group);
        state.nodes.push({ ...op.node });
      } else if ('edge' in op) {
        findNode(op.edge.from);
        findNode(op.edge.to);
        const id = edgeId(op.edge);
        if (state.edges.some((e) => edgeId(e) === id)) fail(`duplicate edge "${id}"`);
        state.edges.push({ ...op.edge });
      } else {
        if (state.groups.some((g) => g.id === op.group.id)) fail(`duplicate group "${op.group.id}"`);
        if (op.group.parent !== undefined) findGroup(op.group.parent);
        state.groups.push({ ...op.group });
      }
      return;
    }
    case 'remove': {
      if ('node' in op) {
        findNode(op.node);
        state.nodes = state.nodes.filter((n) => n.id !== op.node);
        state.edges = state.edges.filter((e) => e.from !== op.node && e.to !== op.node);
      } else if ('edge' in op) {
        findEdge(op.edge);
        state.edges = state.edges.filter((e) => edgeId(e) !== op.edge);
      } else {
        const group = findGroup(op.group);
        // Members and child groups fall back to the removed group's parent.
        for (const node of state.nodes) {
          if (node.group === group.id) node.group = group.parent;
        }
        for (const child of state.groups) {
          if (child.parent === group.id) child.parent = group.parent;
        }
        state.groups = state.groups.filter((g) => g.id !== group.id);
      }
      return;
    }
    case 'set': {
      if ('node' in op) {
        const { op: _op, node: id, ...patch } = op;
        if (patch.group !== undefined) findGroup(patch.group);
        Object.assign(findNode(id), patch);
      } else if ('edge' in op) {
        const { op: _op, edge: id, ...patch } = op;
        Object.assign(findEdge(id), patch);
      } else {
        const { op: _op, group: id, ...patch } = op;
        if (patch.parent !== undefined) findGroup(patch.parent);
        Object.assign(findGroup(id), patch);
      }
      return;
    }
    case 'move': {
      if ('node' in op) {
        const node = findNode(op.node);
        if (op.group === null) {
          delete node.group;
        } else {
          findGroup(op.group);
          node.group = op.group;
        }
      } else {
        const group = findGroup(op.group);
        if (op.parent === null) {
          delete group.parent;
        } else {
          if (op.parent === group.id) fail(`group "${group.id}" cannot be its own parent`);
          findGroup(op.parent);
          group.parent = op.parent;
        }
      }
      return;
    }
  }
}

function validateState(state: GraphState, stepIndex: number): void {
  const nodeIds = new Set<string>();
  const groupIds = new Set(state.groups.map((g) => g.id));

  for (const node of state.nodes) {
    if (nodeIds.has(node.id)) throw new StoryError(stepIndex, `duplicate node "${node.id}"`);
    nodeIds.add(node.id);
    if (node.group !== undefined && !groupIds.has(node.group)) {
      throw new StoryError(stepIndex, `node "${node.id}" references unknown group "${node.group}"`);
    }
  }

  for (const group of state.groups) {
    // Walk up the parent chain to catch cycles and dangling parents.
    const seen = new Set<string>([group.id]);
    let parent = group.parent;
    while (parent !== undefined) {
      if (!groupIds.has(parent)) throw new StoryError(stepIndex, `group "${group.id}" references unknown parent "${parent}"`);
      if (seen.has(parent)) throw new StoryError(stepIndex, `group "${group.id}" has a cyclic parent chain`);
      seen.add(parent);
      parent = state.groups.find((g) => g.id === parent)?.parent;
    }
  }

  const edgeIds = new Set<string>();
  for (const edge of state.edges) {
    const id = edgeId(edge);
    if (edgeIds.has(id)) throw new StoryError(stepIndex, `duplicate edge "${id}"`);
    edgeIds.add(id);
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new StoryError(stepIndex, `edge "${id}" references an unknown node`);
    }
  }
}

/**
 * Turns the declarative step list into a list of full states, applying ops on
 * top of the previous step. Throws with a step index on any dangling reference.
 */
export function resolveStory(spec: GraphStorySpec): ResolvedStep[] {
  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    throw new Error('graph story needs at least one step');
  }

  const resolved: ResolvedStep[] = [];
  let previous = emptyState();

  spec.steps.forEach((step, index) => {
    const state = cloneState(step.state ?? previous);

    for (const op of step.ops ?? []) {
      applyOp(state, op, index);
    }

    validateState(state, index);
    resolved.push({
      index,
      title: step.title ?? '',
      caption: step.caption ?? '',
      state,
    });
    previous = state;
  });

  return resolved;
}
