import type {
  EdgeSpec,
  GraphOp,
  GraphState,
  GraphStorySpec,
  GroupSpec,
  NodeSpec,
  ResolvedStep,
  StepFocus,
} from './types';

export const edgeId = (edge: EdgeSpec): string => edge.id ?? `${edge.from}->${edge.to}`;

const emptyState = (): GraphState => ({ nodes: [], edges: [], groups: [] });

/** Assigns patch fields onto target; `null` clears the field. */
function applyPatch<T extends object>(target: T, patch: { [K in keyof T]?: T[K] | null }): void {
  for (const key of Object.keys(patch) as (keyof T)[]) {
    const value = patch[key];
    if (value === null) {
      delete target[key];
    } else if (value !== undefined) {
      target[key] = value;
    }
  }
}

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
        if (patch.group !== undefined && patch.group !== null) findGroup(patch.group);
        applyPatch(findNode(id), patch);
      } else if ('edge' in op) {
        const { op: _op, edge: id, ...patch } = op;
        applyPatch(findEdge(id), patch);
      } else {
        const { op: _op, group: id, ...patch } = op;
        if (patch.parent !== undefined && patch.parent !== null) findGroup(patch.parent);
        applyPatch(findGroup(id), patch);
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

/** Collects the ids an op touches (removals excluded: they are gone by the time the step renders). */
function touchedBy(op: GraphOp, state: GraphState, focus: StepFocus): void {
  const edgeEnds = (edge: EdgeSpec) => {
    focus.nodes.add(edge.from);
    focus.nodes.add(edge.to);
  };
  switch (op.op) {
    case 'add':
      if ('node' in op) focus.nodes.add(op.node.id);
      else if ('edge' in op) edgeEnds(op.edge);
      else focus.groups.add(op.group.id);
      return;
    case 'set':
      if ('node' in op) focus.nodes.add(op.node);
      else if ('edge' in op) {
        const edge = state.edges.find((e) => edgeId(e) === op.edge);
        if (edge) edgeEnds(edge);
      } else focus.groups.add(op.group);
      return;
    case 'move':
      if ('node' in op) {
        focus.nodes.add(op.node);
        if (op.group) focus.groups.add(op.group);
      } else focus.groups.add(op.group);
      return;
    case 'remove':
      return;
  }
}

function resolveFocus(step: { focus?: string[] | 'all'; state?: GraphState; ops?: GraphOp[] }, state: GraphState): StepFocus {
  const focus: StepFocus = { all: false, nodes: new Set(), groups: new Set() };
  if (step.focus === 'all' || (step.state && !step.focus)) {
    // Still record what changed so narrow screens have something to frame.
    focus.all = true;
    for (const op of step.ops ?? []) touchedBy(op, state, focus);
    if (focus.nodes.size === 0 && focus.groups.size === 0) {
      for (const n of state.nodes) focus.nodes.add(n.id);
    }
    return focus;
  }
  if (Array.isArray(step.focus)) {
    const groupIds = new Set(state.groups.map((g) => g.id));
    for (const id of step.focus) (groupIds.has(id) ? focus.groups : focus.nodes).add(id);
    return focus;
  }
  for (const op of step.ops ?? []) touchedBy(op, state, focus);
  // Drop ids that no longer exist after this step's ops.
  const nodeIds = new Set(state.nodes.map((n) => n.id));
  const groupIds = new Set(state.groups.map((g) => g.id));
  for (const id of focus.nodes) if (!nodeIds.has(id)) focus.nodes.delete(id);
  for (const id of focus.groups) if (!groupIds.has(id)) focus.groups.delete(id);
  if (focus.nodes.size === 0 && focus.groups.size === 0) focus.all = true;
  return focus;
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
      body: step.body ?? '',
      state,
      focus: resolveFocus(step, state),
    });
    previous = state;
  });

  return resolved;
}
