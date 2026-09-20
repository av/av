/**
 * Declarative data model for animated graph stories.
 *
 * A story is a list of steps. Each step either declares a full graph state or a
 * list of operations applied to the previous step. Objects keep their identity
 * (by `id`) across steps, which is what lets the renderer animate changes
 * instead of cutting between pictures.
 */

export type Accent =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'cyan'
  | 'blue'
  | 'purple'
  | 'magenta'
  | 'tx'
  | 'tx2'
  | 'tx3';

export type NodeShape = 'circle' | 'rect' | 'diamond' | 'hex' | 'pill';

export type NodeState = 'default' | 'active' | 'muted' | 'pending' | 'error';

export type EdgeStyle = 'solid' | 'dashed' | 'flow';

export interface NodeSpec {
  id: string;
  label?: string;
  sublabel?: string;
  /** Free-form category; picks a default shape (see `shapeForKind`). */
  kind?: string;
  shape?: NodeShape;
  color?: Accent;
  /** Radius multiplier, 1 = default. */
  size?: number;
  state?: NodeState;
  /** Innermost group id. */
  group?: string;
  /** Optional pinned position, percent of the stage width. */
  x?: number;
  /** Optional pinned position, percent of the stage height. */
  y?: number;
}

export interface EdgeSpec {
  /** Defaults to `${from}->${to}`. */
  id?: string;
  from: string;
  to: string;
  label?: string;
  color?: Accent;
  style?: EdgeStyle;
  /** Arrowhead at `to`; defaults to true. */
  directed?: boolean;
  state?: NodeState;
}

export interface GroupSpec {
  id: string;
  label?: string;
  color?: Accent;
  /** Parent group id for nested groups. */
  parent?: string;
  /** Optional anchor, percent of the stage width. */
  x?: number;
  /** Optional anchor, percent of the stage height. */
  y?: number;
}

export interface GraphState {
  nodes: NodeSpec[];
  edges: EdgeSpec[];
  groups: GroupSpec[];
}

export type NodePatch = Partial<Omit<NodeSpec, 'id'>>;
export type EdgePatch = Partial<Omit<EdgeSpec, 'id' | 'from' | 'to'>>;
export type GroupPatch = Partial<Omit<GroupSpec, 'id'>>;

export type GraphOp =
  | { op: 'add'; node: NodeSpec }
  | { op: 'add'; edge: EdgeSpec }
  | { op: 'add'; group: GroupSpec }
  | { op: 'remove'; node: string }
  | { op: 'remove'; edge: string }
  | { op: 'remove'; group: string }
  | ({ op: 'set'; node: string } & NodePatch)
  | ({ op: 'set'; edge: string } & EdgePatch)
  | ({ op: 'set'; group: string } & GroupPatch)
  | { op: 'move'; node: string; group: string | null }
  | { op: 'move'; group: string; parent: string | null };

export interface GraphStep {
  title?: string;
  /** Caption text; a small subset of inline HTML is allowed (author content). */
  caption?: string;
  /** Full state for this step. When omitted, the previous state is reused. */
  state?: GraphState;
  /** Operations applied after `state` (or to the previous step's state). */
  ops?: GraphOp[];
}

export type StoryTrigger = 'scroll' | 'click' | 'timeline';

export interface GraphStorySpec {
  steps: GraphStep[];
  /** How steps advance; defaults to `click`. */
  trigger?: StoryTrigger;
  /** Milliseconds per step for `timeline`; defaults to 2400. */
  interval?: number;
  /** Stage aspect ratio (width / height); defaults to 1.6. */
  aspect?: number;
  /** Seed for deterministic layout; defaults to `graph-story`. */
  seed?: string;
}

/** A step with its state fully resolved. */
export interface ResolvedStep {
  index: number;
  title: string;
  caption: string;
  state: GraphState;
}
