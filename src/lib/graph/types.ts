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
  /** Card size multiplier, 1 = default. Below 1 only the height shrinks, so the label always fits. */
  size?: number;
  state?: NodeState;
  /** Innermost group id. */
  group?: string;
  /**
   * Former pinned position (percent of the stage). The layered layout places
   * every card itself, so this is accepted for older stories and ignored.
   */
  x?: number;
  /** See `x`. */
  y?: number;
}

export interface EdgeSpec {
  /** Defaults to `${from}->${to}`. */
  id?: string;
  /**
   * Node or group id. An edge to a group ends on its panel: something that
   * reaches a whole machine rather than one thing on it.
   */
  from: string;
  /** Node or group id; see `from`. */
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
  /** Former anchor (percent of the stage); accepted and ignored, like `NodeSpec.x`. */
  x?: number;
  /** See `x`. */
  y?: number;
}

export interface GraphState {
  nodes: NodeSpec[];
  edges: EdgeSpec[];
  groups: GroupSpec[];
}

/** Patch values may be `null` to clear a previously set field. */
type Clearable<T> = { [K in keyof T]?: T[K] | null };

export type NodePatch = Clearable<Omit<NodeSpec, 'id'>>;
export type EdgePatch = Clearable<Omit<EdgeSpec, 'id' | 'from' | 'to'>>;
export type GroupPatch = Clearable<Omit<GroupSpec, 'id'>>;

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
  /** Longer explanation shown in scroll mode panels (inline HTML allowed). */
  body?: string;
  /**
   * What the camera frames and what stays lit. Defaults to the ids touched by
   * this step's ops (everything for a full `state`). `'all'` shows the whole
   * graph; an id list frames those nodes/groups.
   */
  focus?: string[] | 'all';
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
  /** Former force-layout seed. The layered layout is deterministic without one; ignored. */
  seed?: string;
}

/** A step with its state fully resolved. */
export interface ResolvedStep {
  index: number;
  title: string;
  caption: string;
  body: string;
  state: GraphState;
  /** Ids to frame and keep lit; `all` disables dimming. */
  focus: StepFocus;
}

export interface StepFocus {
  all: boolean;
  nodes: Set<string>;
  groups: Set<string>;
  /**
   * Groups framed and lit as a panel only, because an edge of this step ends
   * on them: the machine is what it reaches, not everything running on it.
   */
  panels: Set<string>;
  /** Edges the step itself touched; only these are lit. */
  edges: Set<string>;
}
