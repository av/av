import * as d3 from 'd3';

import { shapePath, shapeRadius } from './shapes';
import type { Layout, LayoutEdge, LayoutGroup, LayoutNode } from './layout';
import type { Accent } from './types';

const ACCENTS: Accent[] = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta', 'tx', 'tx2', 'tx3'];
const ARROW_GAP = 5;
// Named transitions so fades and geometry tweens on one element run together
// instead of interrupting each other.
const FADE = 'gs-fade';
const MOVE = 'gs-move';
const LABEL_OFFSET = 15;
const SUBLABEL_OFFSET = 30;

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
    exit: { delay: 0, duration: duration * 0.4 },
    move: { delay: duration * 0.2, duration: duration * 0.8 },
    enter: { delay: duration * 0.6, duration: duration * 0.5 },
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

  render(layout: Layout, duration: number): void {
    const timing = timingFor(duration);
    this.edgeIndex = new Map(layout.edges.map((e) => [e.id, e]));

    // Nodes first so their tweens run before edges read `px`/`py` each frame.
    this.renderNodes(layout.nodes, timing);
    this.renderEdges(layout.edges, timing);
    this.renderGroups(layout.groups, timing);
  }

  private renderGroups(groups: LayoutGroup[], timing: Timing): void {
    const sel = this.groupLayer
      .selectAll<SVGGElement, LayoutGroup>('g.gs-group')
      .data(groups, (g) => g.id);

    const enter = sel
      .enter()
      .append('g')
      .attr('class', 'gs-group')
      .style('opacity', 0);
    enter.append('rect').attr('rx', 14).attr('ry', 14);
    enter.append('text').attr('class', 'gs-group__label');

    enter
      .select('rect')
      .attr('x', (g) => g.box.x)
      .attr('y', (g) => g.box.y)
      .attr('width', (g) => g.box.width)
      .attr('height', (g) => g.box.height);
    enter.select('text').attr('x', (g) => g.box.x + 14).attr('y', (g) => g.box.y + 20);
    enter.transition(FADE).delay(timing.enter.delay).duration(timing.enter.duration).style('opacity', 1);

    sel
      .exit<LayoutGroup>()
      .transition(FADE)
      .delay(timing.exit.delay)
      .duration(timing.exit.duration)
      .style('opacity', 0)
      .remove();

    const merged: GroupSel = enter.merge(sel).sort((a, b) => a.depth - b.depth);
    merged.attr('class', (g) => `gs-group is-color-${g.color} is-depth-${g.depth}`);
    merged.select<SVGTextElement>('text').text((g) => g.spec.label ?? '');

    const updated = sel.transition(MOVE).delay(timing.move.delay).duration(timing.move.duration).ease(d3.easeCubicInOut);
    updated
      .select('rect')
      .attr('x', (g) => g.box.x)
      .attr('y', (g) => g.box.y)
      .attr('width', (g) => g.box.width)
      .attr('height', (g) => g.box.height);
    updated
      .select('text')
      .attr('x', (g) => g.box.x + 14)
      .attr('y', (g) => g.box.y + 20);
  }

  private renderNodes(nodes: LayoutNode[], timing: Timing): void {
    const sel = this.nodeLayer
      .selectAll<SVGGElement, LayoutNode>('g.gs-node')
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
      .attr('d', (n) => shapePath(n.shape, n.r))
      .attr('transform', 'scale(0.2)');
    enter.append('text').attr('class', 'gs-node__label').attr('y', (n) => n.r + LABEL_OFFSET);
    enter.append('text').attr('class', 'gs-node__sublabel').attr('y', (n) => n.r + SUBLABEL_OFFSET);

    const entering = enter.transition(FADE).delay(timing.enter.delay).duration(timing.enter.duration).ease(d3.easeBackOut);
    entering.style('opacity', 1);
    entering.select('path').attr('transform', 'scale(1)');

    const exiting = sel
      .exit<LayoutNode>()
      .transition(FADE)
      .delay(timing.exit.delay)
      .duration(timing.exit.duration)
      .style('opacity', 0);
    exiting.select('path').attr('transform', 'scale(0.2)');
    exiting.remove();

    const merged: NodeSel = enter.merge(sel);
    merged.attr(
      'class',
      (n) => `gs-node is-shape-${n.shape} is-color-${n.color} is-state-${n.spec.state ?? 'default'}${n.spec.kind ? ` is-kind-${n.spec.kind}` : ''}`,
    );
    merged.select<SVGTextElement>('text.gs-node__sublabel').call(swapText, (n: LayoutNode) => n.spec.sublabel ?? '', timing);
    merged.select<SVGTextElement>('text.gs-node__label').call(swapText, (n: LayoutNode) => n.spec.label ?? n.id, timing);

    const moving = sel.transition(MOVE).delay(timing.move.delay).duration(timing.move.duration).ease(d3.easeCubicInOut);
    moving.attrTween('transform', (n) => {
      const ix = d3.interpolateNumber(n.px, n.x);
      const iy = d3.interpolateNumber(n.py, n.y);
      return (t) => {
        n.px = ix(t);
        n.py = iy(t);
        return `translate(${n.px},${n.py})`;
      };
    });
    moving.select('path').attr('d', (n) => shapePath(n.shape, n.r));
    moving.select('text.gs-node__label').attr('y', (n) => n.r + LABEL_OFFSET);
    moving.select('text.gs-node__sublabel').attr('y', (n) => n.r + SUBLABEL_OFFSET);

    if (timing.move.duration === 0) {
      for (const n of nodes) {
        n.px = n.x;
        n.py = n.y;
      }
    }
  }

  private renderEdges(edges: LayoutEdge[], timing: Timing): void {
    const sel = this.edgeLayer
      .selectAll<SVGGElement, LayoutEdge>('g.gs-edge')
      .data(edges, (e) => e.id);

    const enter = sel.enter().append('g').attr('class', 'gs-edge').style('opacity', 0);
    enter.append('path').attr('class', 'gs-edge__line');
    enter.append('text').attr('class', 'gs-edge__label');
    enter.transition(FADE).delay(timing.enter.delay).duration(timing.enter.duration).style('opacity', 1);

    sel
      .exit<LayoutEdge>()
      .transition(FADE)
      .delay(timing.exit.delay)
      .duration(timing.exit.duration)
      .style('opacity', 0)
      .remove();

    const merged: EdgeSel = enter.merge(sel);
    merged.attr(
      'class',
      (e) => `gs-edge is-color-${e.color} is-style-${e.spec.style ?? 'solid'} is-state-${e.spec.state ?? 'default'}`,
    );
    merged
      .select<SVGPathElement>('path')
      .attr('marker-end', (e) => (e.spec.directed === false ? null : `url(#${this.uid}-arrow-${e.color})`));
    merged.select<SVGTextElement>('text').text((e) => e.spec.label ?? '');

    // Edges follow their endpoints' painted position every frame, whether the
    // endpoints are moving, entering, or standing still.
    const follow = merged.transition(MOVE).delay(0).duration(timing.move.delay + timing.move.duration);
    follow.select<SVGPathElement>('path').attrTween('d', (e) => () => this.edgePath(e));
    follow
      .select<SVGTextElement>('text')
      .attrTween('transform', (e) => () => this.edgeLabelTransform(e));

    if (timing.move.duration === 0) {
      merged.select<SVGPathElement>('path').attr('d', (e) => this.edgePath(e));
      merged.select<SVGTextElement>('text').attr('transform', (e) => this.edgeLabelTransform(e));
    }
  }

  private edgeGeometry(e: LayoutEdge): { x0: number; y0: number; x1: number; y1: number; cx: number; cy: number } {
    const { source: s, target: t } = e;
    const dx = t.px - s.px;
    const dy = t.py - s.py;
    const theta = Math.atan2(dy, dx);
    const length = Math.hypot(dx, dy) || 1;
    const ux = dx / length;
    const uy = dy / length;

    const startTrim = shapeRadius(s.shape, s.r, theta) + 2;
    const endTrim = shapeRadius(t.shape, t.r, theta + Math.PI) + (e.spec.directed === false ? 2 : ARROW_GAP);
    const x0 = s.px + ux * startTrim;
    const y0 = s.py + uy * startTrim;
    const x1 = t.px - ux * endTrim;
    const y1 = t.py - uy * endTrim;

    // Bend when an edge in the opposite direction exists so both stay visible.
    const reverse = this.edgeIndex.has(`${e.spec.to}->${e.spec.from}`);
    const bend = reverse ? 0.16 * length : 0;
    const cx = (x0 + x1) / 2 - uy * bend;
    const cy = (y0 + y1) / 2 + ux * bend;

    return { x0, y0, x1, y1, cx, cy };
  }

  private edgePath(e: LayoutEdge): string {
    const g = this.edgeGeometry(e);
    return `M${g.x0.toFixed(1)},${g.y0.toFixed(1)}Q${g.cx.toFixed(1)},${g.cy.toFixed(1)} ${g.x1.toFixed(1)},${g.y1.toFixed(1)}`;
  }

  private edgeLabelTransform(e: LayoutEdge): string {
    const g = this.edgeGeometry(e);
    // Point on the quadratic curve at t = 0.5.
    const x = 0.25 * g.x0 + 0.5 * g.cx + 0.25 * g.x1;
    const y = 0.25 * g.y0 + 0.5 * g.cy + 0.25 * g.y1;
    return `translate(${x.toFixed(1)},${y.toFixed(1)})`;
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
      .style('opacity', 0)
      .transition()
      .duration(0)
      .text(next)
      .transition()
      .duration(half)
      .style('opacity', 1);
  });
}
