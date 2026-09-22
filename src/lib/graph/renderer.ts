import * as d3 from 'd3';

import { cardPath, cardRadius, labelOffsetX, sigilForKind, sigilOffsetX } from './shapes';
import type { Box, Layout, LayoutEdge, LayoutGroup, LayoutNode } from './layout';
import type { Accent, StepFocus } from './types';

const ACCENTS: Accent[] = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta', 'tx', 'tx2', 'tx3'];
const ARROW_GAP = 6;
// Named transitions so fades and geometry tweens on one element run together
// instead of interrupting each other.
const FADE = 'gs-fade';
const MOVE = 'gs-move';
const CAMERA = 'gs-camera';
/** Advance width of the edge-label font, for sizing its plate. */
const EDGE_LABEL_ADVANCE = 7.4;
/** Edges longer than this are routed orthogonally instead of drawn as diagonals. */
const LONG_EDGE = 260;
/** Corner radius on a routed edge. */
const ELBOW_RADIUS = 10;
/** How far a routed edge's channel is nudged off centre, to separate parallel runs. */
const CHANNEL_SPREAD = 44;
/**
 * Text centres inside the card, relative to its centre. Two lines are centred
 * as a block: 15px over 11px with a small gap is 29 units tall.
 */
const LABEL_BASELINE = 0;
const LABEL_BASELINE_TWO_LINE = -7;
const SUBLABEL_BASELINE = 9;

type GroupSel = d3.Selection<SVGGElement, LayoutGroup, SVGGElement, unknown>;
type EdgeSel = d3.Selection<SVGGElement, LayoutEdge, SVGGElement, unknown>;
type NodeSel = d3.Selection<SVGGElement, LayoutNode, SVGGElement, unknown>;

interface Timing {
  exit: { delay: number; duration: number };
  move: { delay: number; duration: number };
  enter: { delay: number; duration: number };
}

function timingFor(duration: number): Timing {
  return {
    // Strictly sequential phases: things leave, the rest rearranges, new things
    // appear into the finished layout.
    exit: { delay: 0, duration: duration * 0.35 },
    move: { delay: duration * 0.3, duration: duration * 0.7 },
    enter: { delay: duration * 0.95, duration: duration * 0.45 },
  };
}

let instanceCounter = 0;

/**
 * SVG renderer. Geometry is animated with D3 transitions; colour and state
 * changes go through CSS classes so the stylesheet owns the palette.
 */
export default class GraphRenderer {
  private readonly svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private readonly uid: string;
  private readonly groupLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
  private readonly edgeLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
  private readonly nodeLayer: d3.Selection<SVGGElement, unknown, null, undefined>;
  private edgeIndex = new Map<string, LayoutEdge>();
  /** Position currently painted for each node; tweens converge on the layout target. */
  private readonly painted = new Map<string, { x: number; y: number }>();

  constructor(svg: SVGSVGElement, width: number, height: number) {
    this.uid = `gs${instanceCounter++}`;
    this.svg = d3.select(svg).attr('viewBox', `0 0 ${width} ${height}`).attr('preserveAspectRatio', 'xMidYMid meet');

    const defs = this.svg.append('defs');
    for (const accent of ACCENTS) {
      defs
        .append('marker')
        .attr('id', `${this.uid}-arrow-${accent}`)
        .attr('class', `gs-arrow is-color-${accent}`)
        .attr('viewBox', '0 0 10 10')
        .attr('refX', 9)
        .attr('refY', 5)
        .attr('markerWidth', 7)
        .attr('markerHeight', 7)
        .attr('orient', 'auto-start-reverse')
        .append('path')
        .attr('d', 'M0,1L9,5L0,9Z');
    }

    this.groupLayer = this.svg.append('g').attr('class', 'gs-groups');
    this.edgeLayer = this.svg.append('g').attr('class', 'gs-edges');
    this.nodeLayer = this.svg.append('g').attr('class', 'gs-nodes');
  }

  render(layout: Layout, duration: number, focus?: StepFocus): void {
    const timing = timingFor(duration);
    this.edgeIndex = new Map(layout.edges.map((e) => [e.id, e]));
    this.lit = focus && !focus.all ? litSet(layout, focus) : null;
    this.svg.classed('is-focused', this.lit !== null);

    // Nodes first so their tweens run before edges read `px`/`py` each frame.
    this.renderNodes(layout.nodes, timing);
    this.renderEdges(layout.edges, timing);
    this.renderGroups(layout.groups, timing);
  }

  /** Ids that stay fully lit; null means nothing is dimmed. */
  private lit: { nodes: Set<string>; groups: Set<string> } | null = null;

  private dimNode(n: LayoutNode): boolean {
    return this.lit !== null && !this.lit.nodes.has(n.id);
  }

  /** Animates the viewBox to frame `box`. */
  setCamera(box: Box, duration: number): void {
    const view = `${box.x.toFixed(1)} ${box.y.toFixed(1)} ${box.width.toFixed(1)} ${box.height.toFixed(1)}`;
    if (duration === 0) {
      this.svg.interrupt(CAMERA).attr('viewBox', view);
      return;
    }
    this.svg.transition(CAMERA).duration(duration).ease(d3.easeCubicInOut).attr('viewBox', view);
  }

  private renderGroups(groups: LayoutGroup[], timing: Timing): void {
    const sel = this.groupLayer
      .selectAll<SVGGElement, LayoutGroup>('g.gs-group:not(.is-exiting)')
      .data(groups, (g) => g.id);

    const enter = sel
      .enter()
      .append('g')
      .attr('class', 'gs-group')
      .style('opacity', 0);
    enter.append('rect').attr('class', 'gs-group__panel');
    // A plate that knocks the label out of the panel border, like a TUI title.
    enter.append('rect').attr('class', 'gs-group__legend');
    enter.append('text').attr('class', 'gs-group__label');

    enter.select('rect.gs-group__panel').call(placePanel);
    enter.select('text.gs-group__label').call(placeGroupLabel);
    enter.select('rect.gs-group__legend').call(placeLegend);
    enter.transition(FADE).delay(timing.enter.delay).duration(timing.enter.duration).style('opacity', 1);

    sel
      .exit<LayoutGroup>()
      .classed('is-exiting', true)
      .transition(FADE)
      .delay(timing.exit.delay)
      .duration(timing.exit.duration)
      .style('opacity', 0)
      .remove();

    const merged: GroupSel = enter.merge(sel).sort((a, b) => a.depth - b.depth);
    merged.attr(
      'class',
      (g) => `gs-group is-color-${g.color} is-depth-${g.depth}${this.lit && !this.lit.groups.has(g.id) ? ' is-dim' : ''}`,
    );
    merged.select<SVGTextElement>('text.gs-group__label').text((g) => g.spec.label ?? '');

    const updated = sel.transition(MOVE).delay(timing.move.delay).duration(timing.move.duration).ease(d3.easeCubicInOut);
    updated.select('rect.gs-group__panel').call(placePanel);
    updated.select('text.gs-group__label').call(placeGroupLabel);
    updated.select('rect.gs-group__legend').call(placeLegend);
  }

  private renderNodes(nodes: LayoutNode[], timing: Timing): void {
    const sel = this.nodeLayer
      .selectAll<SVGGElement, LayoutNode>('g.gs-node:not(.is-exiting)')
      .data(nodes, (n) => n.id);

    const enter = sel
      .enter()
      .append('g')
      .attr('class', 'gs-node')
      .attr('transform', (n) => `translate(${n.x},${n.y})`)
      .style('opacity', 0);
    enter
      .append('path')
      .attr('class', 'gs-node__shape')
      .attr('d', (n) => cardPath(n.shape, n.width, n.height))
      .attr('transform', 'scale(0.86)');
    enter
      .append('text')
      .attr('class', 'gs-node__sigil')
      .attr('x', (n) => sigilOffsetX(n.width))
      .attr('y', LABEL_BASELINE)
      .text((n) => sigilForKind(n.spec.kind));
    enter
      .append('text')
      .attr('class', 'gs-node__label')
      .attr('x', (n) => labelOffsetX(n.width))
      .attr('y', (n) => (n.spec.sublabel ? LABEL_BASELINE_TWO_LINE : LABEL_BASELINE));
    enter
      .append('text')
      .attr('class', 'gs-node__sublabel')
      .attr('x', (n) => labelOffsetX(n.width))
      .attr('y', SUBLABEL_BASELINE);

    const entering = enter.transition(FADE).delay(timing.enter.delay).duration(timing.enter.duration).ease(d3.easeBackOut);
    entering.style('opacity', 1);
    entering.select('path').attr('transform', 'scale(1)');

    const exiting = sel
      .exit<LayoutNode>()
      .classed('is-exiting', true)
      .transition(FADE)
      .delay(timing.exit.delay)
      .duration(timing.exit.duration)
      .style('opacity', 0);
    exiting.select('path').attr('transform', 'scale(0.86)');
    exiting.remove();

    const merged: NodeSel = enter.merge(sel);
    merged.attr(
      'class',
      (n) =>
        `gs-node is-shape-${n.shape} is-color-${n.color} is-state-${n.spec.state ?? 'default'}${n.spec.kind ? ` is-kind-${n.spec.kind}` : ''}${this.dimNode(n) ? ' is-dim' : ''}`,
    );
    merged.select<SVGTextElement>('text.gs-node__sigil').text((n) => sigilForKind(n.spec.kind));
    merged.select<SVGTextElement>('text.gs-node__sublabel').call(swapText, (n: LayoutNode) => n.spec.sublabel ?? '', timing);
    merged.select<SVGTextElement>('text.gs-node__label').call(swapText, (n: LayoutNode) => n.spec.label ?? n.id, timing);

    for (const n of nodes) {
      if (!this.painted.has(n.id)) this.painted.set(n.id, { x: n.x, y: n.y });
    }

    const moving = sel.transition(MOVE).delay(timing.move.delay).duration(timing.move.duration).ease(d3.easeCubicInOut);
    moving.attrTween('transform', (n) => {
      const p = this.paintedOf(n);
      const ix = d3.interpolateNumber(p.x, n.x);
      const iy = d3.interpolateNumber(p.y, n.y);
      return (t) => {
        p.x = ix(t);
        p.y = iy(t);
        return `translate(${p.x},${p.y})`;
      };
    });
    moving.select('path').attr('d', (n) => cardPath(n.shape, n.width, n.height));
    moving.select('text.gs-node__sigil').attr('x', (n) => sigilOffsetX(n.width));
    moving
      .select('text.gs-node__label')
      .attr('x', (n) => labelOffsetX(n.width))
      .attr('y', (n) => (n.spec.sublabel ? LABEL_BASELINE_TWO_LINE : LABEL_BASELINE));
    moving.select('text.gs-node__sublabel').attr('x', (n) => labelOffsetX(n.width));

    if (timing.move.duration === 0) {
      for (const n of nodes) this.painted.set(n.id, { x: n.x, y: n.y });
    }
  }

  private paintedOf(n: LayoutNode): { x: number; y: number } {
    let p = this.painted.get(n.id);
    if (!p) {
      p = { x: n.x, y: n.y };
      this.painted.set(n.id, p);
    }
    return p;
  }

  private renderEdges(edges: LayoutEdge[], timing: Timing): void {
    const sel = this.edgeLayer
      .selectAll<SVGGElement, LayoutEdge>('g.gs-edge:not(.is-exiting)')
      .data(edges, (e) => e.id);

    const enter = sel.enter().append('g').attr('class', 'gs-edge').style('opacity', 0);
    enter.append('path').attr('class', 'gs-edge__line');
    // A plate behind the label so the line does not run through the text.
    enter.append('rect').attr('class', 'gs-edge__plate').attr('rx', 1);
    enter.append('text').attr('class', 'gs-edge__label');
    enter.transition(FADE).delay(timing.enter.delay).duration(timing.enter.duration).style('opacity', 1);

    sel
      .exit<LayoutEdge>()
      .classed('is-exiting', true)
      .transition(FADE)
      .delay(timing.exit.delay)
      .duration(timing.exit.duration)
      .style('opacity', 0)
      .remove();

    const merged: EdgeSel = enter.merge(sel);
    merged.attr(
      'class',
      (e) =>
        `gs-edge is-color-${e.color} is-style-${e.spec.style ?? 'solid'} is-state-${e.spec.state ?? 'default'}${this.dimNode(e.source) && this.dimNode(e.target) ? ' is-dim' : ''}`,
    );
    merged
      .select<SVGPathElement>('path')
      .attr('marker-end', (e) => (e.spec.directed === false ? null : `url(#${this.uid}-arrow-${e.color})`));
    merged.select<SVGTextElement>('text').text((e) => e.spec.label ?? '');
    merged.each(function (e) {
      const label = e.spec.label ?? '';
      const plate = d3.select(this).select<SVGRectElement>('rect.gs-edge__plate');
      if (!label) {
        plate.attr('width', 0).attr('height', 0);
        return;
      }
      const width = label.length * EDGE_LABEL_ADVANCE + 8;
      plate.attr('x', -width / 2).attr('y', -8).attr('width', width).attr('height', 16);
    });

    // Edges follow their endpoints' painted position every frame, whether the
    // endpoints are moving, entering, or standing still.
    const follow = merged.transition(MOVE).delay(0).duration(timing.move.delay + timing.move.duration);
    follow.select<SVGPathElement>('path').attrTween('d', (e) => () => this.edgePath(e));
    follow
      .select<SVGTextElement>('text')
      .attrTween('transform', (e) => () => this.edgeLabelTransform(e));
    follow
      .select<SVGRectElement>('rect.gs-edge__plate')
      .attrTween('transform', (e) => () => this.edgeLabelTransform(e));

    if (timing.move.duration === 0) {
      merged.select<SVGPathElement>('path').attr('d', (e) => this.edgePath(e));
      merged.select<SVGTextElement>('text').attr('transform', (e) => this.edgeLabelTransform(e));
      merged.select<SVGRectElement>('rect.gs-edge__plate').attr('transform', (e) => this.edgeLabelTransform(e));
    }
  }

  /** Points a straight edge runs between, trimmed to the two card borders. */
  private straightPoints(e: LayoutEdge): Point[] {
    const source = e.source;
    const target = e.target;
    const s = { ...this.paintedOf(source), width: source.width, height: source.height };
    const t = { ...this.paintedOf(target), width: target.width, height: target.height };
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const theta = Math.atan2(dy, dx);
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;

    const startTrim = cardRadius(s.width, s.height, theta) + 2;
    const endTrim = cardRadius(t.width, t.height, theta + Math.PI) + this.endGap(e);
    return [
      { x: s.x + ux * startTrim, y: s.y + uy * startTrim },
      { x: t.x - ux * endTrim, y: t.y - uy * endTrim },
    ];
  }

  private endGap(e: LayoutEdge): number {
    return e.spec.directed === false ? 2 : ARROW_GAP;
  }

  /**
   * Long edges are routed as elbows down a shared channel. Drawn as diagonals
   * they cross the whole diagram at every angle, which is what turns a busy
   * step into spaghetti; orthogonal runs read as a schematic instead.
   */
  private routedPoints(e: LayoutEdge): Point[] {
    const source = e.source;
    const target = e.target;
    const s = { ...this.paintedOf(source), width: source.width, height: source.height };
    const t = { ...this.paintedOf(target), width: target.width, height: target.height };
    const dx = t.x - s.x;
    const dy = t.y - s.y;
    const gap = this.endGap(e);

    // Opposite directions between the same pair take opposite offsets so the
    // two runs never land on top of each other.
    const reversed = this.edgeIndex.has(`${e.spec.to}->${e.spec.from}`) && e.spec.from > e.spec.to;
    const offset = (hashUnit(e.id) - 0.5) * CHANNEL_SPREAD * (reversed ? -1 : 1);

    if (Math.abs(dx) >= Math.abs(dy)) {
      const sx = s.x + Math.sign(dx) * (s.width / 2 + 2);
      const tx = t.x - Math.sign(dx) * (t.width / 2 + gap);
      const midX = (sx + tx) / 2 + offset;
      return [
        { x: sx, y: s.y },
        { x: midX, y: s.y },
        { x: midX, y: t.y },
        { x: tx, y: t.y },
      ];
    }

    const sy = s.y + Math.sign(dy) * (s.height / 2 + 2);
    const ty = t.y - Math.sign(dy) * (t.height / 2 + gap);
    const midY = (sy + ty) / 2 + offset;
    return [
      { x: s.x, y: sy },
      { x: s.x, y: midY },
      { x: t.x, y: midY },
      { x: t.x, y: ty },
    ];
  }

  private edgePoints(e: LayoutEdge): Point[] {
    const s = this.paintedOf(e.source);
    const t = this.paintedOf(e.target);
    return Math.hypot(t.x - s.x, t.y - s.y) >= LONG_EDGE ? this.routedPoints(e) : this.straightPoints(e);
  }

  private edgePath(e: LayoutEdge): string {
    const points = this.edgePoints(e);
    if (points.length === 2) {
      // Short edges bend only when a reverse edge would otherwise sit on top.
      const [a, b] = points;
      if (!this.edgeIndex.has(`${e.spec.to}->${e.spec.from}`)) {
        return `M${a.x.toFixed(1)},${a.y.toFixed(1)}L${b.x.toFixed(1)},${b.y.toFixed(1)}`;
      }
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      const bend = 0.16 * length;
      const cx = (a.x + b.x) / 2 - ((b.y - a.y) / length) * bend;
      const cy = (a.y + b.y) / 2 + ((b.x - a.x) / length) * bend;
      return `M${a.x.toFixed(1)},${a.y.toFixed(1)}Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
    }
    return roundedPolyline(points, ELBOW_RADIUS);
  }

  private edgeLabelTransform(e: LayoutEdge): string {
    const point = polylineMidpoint(this.edgePoints(e));
    return `translate(${point.x.toFixed(1)},${point.y.toFixed(1)})`;
  }
}

/** Fades a text element out, swaps its content, and fades it back in when the text changed. */
function swapText(
  sel: d3.Selection<SVGTextElement, LayoutNode, SVGGElement, unknown>,
  value: (n: LayoutNode) => string,
  timing: Timing,
): void {
  sel.each(function (n) {
    const el = d3.select(this);
    const next = value(n);
    if (el.text() === next) return;
    if (timing.move.duration === 0 || el.text() === '') {
      el.text(next);
      return;
    }
    const half = timing.move.duration / 2;
    el.transition(FADE)
      .delay(timing.move.delay)
      .duration(half)
      .style('fill-opacity', 0)
      .style('stroke-opacity', 0)
      .transition()
      .duration(0)
      .text(next)
      .transition()
      .duration(half)
      .style('fill-opacity', 1)
      .style('stroke-opacity', 1);
  });
}

/** Lit set: focused nodes, members of focused groups, and the groups that contain any lit node. */
function litSet(layout: Layout, focus: StepFocus): { nodes: Set<string>; groups: Set<string> } {
  const nodes = new Set(focus.nodes);
  for (const n of layout.nodes) {
    if (n.path.some((g) => focus.groups.has(g))) nodes.add(n.id);
  }
  const groups = new Set(focus.groups);
  for (const n of layout.nodes) {
    if (nodes.has(n.id)) for (const g of n.path) groups.add(g);
  }
  return { nodes, groups };
}

const GROUP_LABEL_X = 12;
const GROUP_LABEL_ADVANCE = 8.4;

interface GroupPlacement {
  attr(name: string, value: (datum: LayoutGroup) => number | string): GroupPlacement;
}

function placePanel(sel: GroupPlacement): void {
  sel
    .attr('x', (g) => g.box.x)
    .attr('y', (g) => g.box.y)
    .attr('width', (g) => g.box.width)
    .attr('height', (g) => g.box.height);
}

function placeGroupLabel(sel: GroupPlacement): void {
  sel.attr('x', (g) => g.box.x + GROUP_LABEL_X).attr('y', (g) => g.box.y);
}

/** Sized to the label so the panel border is interrupted, not overdrawn. */
function placeLegend(sel: GroupPlacement): void {
  sel
    .attr('x', (g) => g.box.x + GROUP_LABEL_X - 4)
    .attr('y', (g) => g.box.y - 7)
    .attr('width', (g) => (g.spec.label ? g.spec.label.length * GROUP_LABEL_ADVANCE + 8 : 0))
    .attr('height', (g) => (g.spec.label ? 14 : 0));
}

interface Point {
  x: number;
  y: number;
}

function hashUnit(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

/** Polyline with the corners rounded, clamped so short segments stay clean. */
function roundedPolyline(points: Point[], radius: number): string {
  const parts = [`M${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`];

  for (let i = 1; i < points.length - 1; i++) {
    const previous = points[i - 1];
    const corner = points[i];
    const next = points[i + 1];
    const inLength = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const outLength = Math.hypot(next.x - corner.x, next.y - corner.y);
    const r = Math.min(radius, inLength / 2, outLength / 2);

    if (r < 1) {
      parts.push(`L${corner.x.toFixed(1)},${corner.y.toFixed(1)}`);
      continue;
    }

    const enter = {
      x: corner.x + ((previous.x - corner.x) / inLength) * r,
      y: corner.y + ((previous.y - corner.y) / inLength) * r,
    };
    const leave = {
      x: corner.x + ((next.x - corner.x) / outLength) * r,
      y: corner.y + ((next.y - corner.y) / outLength) * r,
    };
    parts.push(`L${enter.x.toFixed(1)},${enter.y.toFixed(1)}`);
    parts.push(`Q${corner.x.toFixed(1)},${corner.y.toFixed(1)} ${leave.x.toFixed(1)},${leave.y.toFixed(1)}`);
  }

  const last = points[points.length - 1];
  parts.push(`L${last.x.toFixed(1)},${last.y.toFixed(1)}`);
  return parts.join('');
}

/** Point halfway along a polyline, by length. */
function polylineMidpoint(points: Point[]): Point {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);

  let travelled = 0;
  for (let i = 1; i < points.length; i++) {
    const segment = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    if (travelled + segment >= total / 2) {
      const t = segment === 0 ? 0 : (total / 2 - travelled) / segment;
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
      };
    }
    travelled += segment;
  }
  return points[points.length - 1];
}
