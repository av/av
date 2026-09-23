import * as d3 from 'd3';

import { GROUP_LABEL_PAD } from './layout';
import type { Box, Layout, LayoutEdge, LayoutGroup, LayoutNode, Point } from './layout';
import { cardPath, labelOffsetX, sigilForKind, sigilOffsetX } from './shapes';
import type { Accent, StepFocus } from './types';

const ACCENTS: Accent[] = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta', 'tx', 'tx2', 'tx3'];
const ARROW_GAP = 6;
// Named transitions so fades and geometry tweens on one element run together
// instead of interrupting each other.
const FADE = 'gs-fade';
const MOVE = 'gs-move';
const CAMERA = 'gs-camera';
/** Corner radius on a routed edge; kept under half the layout's edge spacing. */
const ELBOW_RADIUS = 6;
/** Points a route is resampled to when it morphs into one with a different shape. */
const MORPH_SAMPLES = 24;
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
  /** Position currently painted for each node; tweens converge on the layout target. */
  private readonly painted = new Map<string, { x: number; y: number }>();
  /** Route currently painted for each edge, so a changed route morphs from where it is. */
  private readonly routes = new Map<string, Point[]>();

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
    this.lit = focus && !focus.all ? litSet(layout, focus) : null;
    this.svg.classed('is-focused', this.lit !== null);

    // Nodes first so their tweens run before edges read `px`/`py` each frame.
    this.renderNodes(layout.nodes, timing);
    this.renderEdges(layout.edges, timing);
    this.renderGroups(layout.groups, timing);
  }

  /** Ids that stay fully lit; null means nothing is dimmed. */
  private lit: { nodes: Set<string>; groups: Set<string>; edges: Set<string> } | null = null;

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
      .attr('y', (n) => (n.spec.sublabel ? LABEL_BASELINE_TWO_LINE : LABEL_BASELINE))
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
    moving
      .select('text.gs-node__sigil')
      .attr('x', (n) => sigilOffsetX(n.width))
      .attr('y', (n) => (n.spec.sublabel ? LABEL_BASELINE_TWO_LINE : LABEL_BASELINE));
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

    const exiting = new Set<string>();
    sel
      .exit<LayoutEdge>()
      .each((e) => exiting.add(e.id))
      .classed('is-exiting', true)
      .transition(FADE)
      .delay(timing.exit.delay)
      .duration(timing.exit.duration)
      .style('opacity', 0)
      .remove();
    for (const id of exiting) this.routes.delete(id);

    const merged: EdgeSel = enter.merge(sel);
    merged.attr(
      'class',
      (e) =>
        `gs-edge is-color-${e.color} is-style-${e.spec.style ?? 'solid'} is-state-${e.spec.state ?? 'default'}${this.lit && !this.lit.edges.has(e.id) ? ' is-dim' : ''}`,
    );
    merged
      .select<SVGPathElement>('path')
      .attr('marker-end', (e) => (e.spec.directed === false ? null : `url(#${this.uid}-arrow-${e.color})`));
    merged.select<SVGTextElement>('text').text((e) => e.spec.label ?? '');
    merged.select<SVGRectElement>('rect.gs-edge__plate').each(function (e) {
      const plate = d3.select(this);
      if (!e.label) {
        plate.attr('x', null).attr('y', null).attr('width', 0).attr('height', 0);
        return;
      }
      plate.attr('x', -e.label.width / 2).attr('y', -e.label.height / 2).attr('width', e.label.width).attr('height', e.label.height);
    });

    // New edges appear on their final route once the cards have arrived.
    enter.select<SVGPathElement>('path').attr('d', (e) => roundedPolyline(this.finalRoute(e), ELBOW_RADIUS));
    enter.select<SVGTextElement>('text').attr('transform', (e) => labelTransform(e, 1, null));
    enter.select<SVGRectElement>('rect.gs-edge__plate').attr('transform', (e) => labelTransform(e, 1, null));

    const previous = new Map<string, { route: Point[]; label: Point | null }>();
    sel.each((e) => {
      const route = this.routes.get(e.id);
      if (route) previous.set(e.id, { route, label: this.labels.get(e.id) ?? null });
    });

    // Existing edges morph from the route they had into the new one, in step
    // with the cards they connect.
    const moving = sel.transition(MOVE).delay(timing.move.delay).duration(timing.move.duration).ease(d3.easeCubicInOut);
    moving.select<SVGPathElement>('path').attrTween('d', (e) => {
      const target = this.finalRoute(e);
      const from = previous.get(e.id)?.route ?? target;
      const morph = morphRoutes(from, target);
      return (t) => (t >= 1 ? roundedPolyline(target, ELBOW_RADIUS) : roundedPolyline(morph(t), ELBOW_RADIUS));
    });
    moving.select<SVGTextElement>('text').attrTween('transform', (e) => (t) => labelTransform(e, t, previous.get(e.id)?.label ?? null));
    moving.select<SVGRectElement>('rect.gs-edge__plate').attrTween('transform', (e) => (t) => labelTransform(e, t, previous.get(e.id)?.label ?? null));

    if (timing.move.duration === 0) {
      merged.select<SVGPathElement>('path').attr('d', (e) => roundedPolyline(this.finalRoute(e), ELBOW_RADIUS));
      merged.select<SVGTextElement>('text').attr('transform', (e) => labelTransform(e, 1, null));
      merged.select<SVGRectElement>('rect.gs-edge__plate').attr('transform', (e) => labelTransform(e, 1, null));
    }

    for (const e of edges) {
      this.routes.set(e.id, this.finalRoute(e));
      this.labels.set(e.id, labelCentre(e));
    }
  }

  /** Label centre currently painted per edge. */
  private readonly labels = new Map<string, Point | null>();

  /** The layout's route, pulled back at the target so the arrowhead's tip meets the card. */
  private finalRoute(e: LayoutEdge): Point[] {
    const gap = e.spec.directed === false ? 1 : ARROW_GAP;
    return trimEnd(e.points, gap);
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
      .style('stroke-opacity', 1)
      // Leave no inline style behind, so a replayed step matches a jumped-to one.
      .on('end', function () {
        d3.select(this).style('fill-opacity', null).style('stroke-opacity', null);
        if (!this.getAttribute('style')) this.removeAttribute('style');
      });
  });
}

/** Lit set: focused nodes, members of focused groups, and the groups that contain any lit node. */
function litSet(layout: Layout, focus: StepFocus): { nodes: Set<string>; groups: Set<string>; edges: Set<string> } {
  const nodes = new Set(focus.nodes);
  for (const n of layout.nodes) {
    if (n.path.some((g) => focus.groups.has(g))) nodes.add(n.id);
  }
  const groups = new Set([...focus.groups, ...focus.panels]);
  for (const n of layout.nodes) {
    if (nodes.has(n.id)) for (const g of n.path) groups.add(g);
  }
  return { nodes, groups, edges: new Set(focus.edges) };
}

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
  sel
    .attr('x', (g) => (g.legend ? g.legend.x + GROUP_LABEL_PAD : g.box.x))
    .attr('y', (g) => (g.legend ? g.legend.y + g.legend.height / 2 : g.box.y));
}

/** Plate sized to the label so the panel border is interrupted, not overdrawn; placed by the layout clear of edges. */
function placeLegend(sel: GroupPlacement): void {
  sel
    .attr('x', (g) => g.legend?.x ?? g.box.x)
    .attr('y', (g) => g.legend?.y ?? g.box.y)
    .attr('width', (g) => g.legend?.width ?? 0)
    .attr('height', (g) => g.legend?.height ?? 0);
}

function labelCentre(e: LayoutEdge): Point | null {
  return e.label ? { x: e.label.x + e.label.width / 2, y: e.label.y + e.label.height / 2 } : null;
}

function labelTransform(e: LayoutEdge, t: number, from: Point | null): string {
  const to = labelCentre(e) ?? polylineMidpoint(e.points);
  const start = from ?? to;
  const x = start.x + (to.x - start.x) * t;
  const y = start.y + (to.y - start.y) * t;
  return `translate(${x.toFixed(1)},${y.toFixed(1)})`;
}

/** Shortens a route's last segment so an arrowhead drawn at its end stops at the card. */
function trimEnd(points: Point[], gap: number): Point[] {
  if (points.length < 2) return points;
  const out = points.map((p) => ({ ...p }));
  const last = out[out.length - 1];
  const before = out[out.length - 2];
  const length = Math.hypot(last.x - before.x, last.y - before.y);
  if (length <= gap * 2) return out;
  last.x -= ((last.x - before.x) / length) * gap;
  last.y -= ((last.y - before.y) / length) * gap;
  return out;
}

/**
 * Interpolates one route into another. Routes with the same number of points
 * move corner by corner, which keeps every segment orthogonal on the way;
 * otherwise both are resampled evenly by length.
 */
function morphRoutes(from: Point[], to: Point[]): (t: number) => Point[] {
  const a = from.length === to.length ? from : resample(from, MORPH_SAMPLES);
  const b = from.length === to.length ? to : resample(to, MORPH_SAMPLES);
  return (t) => a.map((p, i) => ({ x: p.x + (b[i].x - p.x) * t, y: p.y + (b[i].y - p.y) * t }));
}

function resample(points: Point[], count: number): Point[] {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const total = lengths[lengths.length - 1] || 1;
  const out: Point[] = [];
  let segment = 1;
  for (let k = 0; k < count; k++) {
    const at = (total * k) / (count - 1);
    while (segment < points.length - 1 && lengths[segment] < at) segment++;
    const span = lengths[segment] - lengths[segment - 1] || 1;
    const t = Math.min(1, Math.max(0, (at - lengths[segment - 1]) / span));
    const a = points[segment - 1];
    const b = points[segment] ?? a;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
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
