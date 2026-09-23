import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import ELK from 'elkjs/lib/elk.bundled.js';

import { edgeId, resolveGraphStates, validateGraphStory } from './graph-story.mjs';
import { buildElkGraph, readElkLayout, storyAffinity } from '../../src/lib/graph/elkGraph.ts';
import { estimateTextWidth, measureCard } from '../../src/lib/graph/shapes.ts';

/**
 * Lays out every step of every story with the same ELK configuration the
 * page uses and checks the geometric promises the diagrams make: cards never
 * overlap, routes are orthogonal and never cross a card, no two edges share a
 * run, and labels sit clear of cards, routes and each other.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const GRAPHS = path.join(ROOT, 'content/blog/graphs');
const elk = new ELK();

async function layoutStep(state, affinity) {
  const cards = new Map(
    state.nodes.map((n) => {
      const card = measureCard(n.label ?? n.id, n.sublabel ?? '', estimateTextWidth);
      const scale = n.size ?? 1;
      return [n.id, { width: card.width * scale, height: card.height * scale }];
    }),
  );
  const edgeLabels = new Map(state.edges.filter((e) => e.label).map((e) => [edgeId(e), { width: estimateTextWidth(e.label, 11) + 10, height: 16 }]));
  const groupLabels = new Map(state.groups.filter((g) => g.label).map((g) => [g.id, { width: estimateTextWidth(g.label, 12) * 1.2 + 18, height: 16 }]));
  const { graph, reversed } = buildElkGraph({ state, direction: 'DOWN', cards, edgeLabels, groupLabels, edgeId, affinity });
  const placement = readElkLayout(await elk.layout(graph), new Set(state.groups.map((g) => g.id)), reversed);
  return { cards, placement };
}

const rectOf = (centre, size) => ({ x0: centre.x - size.width / 2, y0: centre.y - size.height / 2, x1: centre.x + size.width / 2, y1: centre.y + size.height / 2 });
const boxRect = (box) => ({ x0: box.x, y0: box.y, x1: box.x + box.width, y1: box.y + box.height });
const overlaps = (a, b, inset = 0) => a.x0 + inset < b.x1 && b.x0 + inset < a.x1 && a.y0 + inset < b.y1 && b.y0 + inset < a.y1;

/** True when an axis-aligned segment enters the rectangle's interior (shrunk by `inset`). */
function segmentHitsRect(a, b, rect, inset = 1) {
  const r = { x0: rect.x0 + inset, y0: rect.y0 + inset, x1: rect.x1 - inset, y1: rect.y1 - inset };
  return Math.max(a.x, b.x) > r.x0 && Math.min(a.x, b.x) < r.x1 && Math.max(a.y, b.y) > r.y0 && Math.min(a.y, b.y) < r.y1;
}

/** Length two axis-aligned segments run on top of each other. */
function sharedRun(a1, a2, b1, b2) {
  const vertical = (p, q) => Math.abs(p.x - q.x) < 0.5;
  if (vertical(a1, a2) && vertical(b1, b2) && Math.abs(a1.x - b1.x) < 2) {
    return Math.min(Math.max(a1.y, a2.y), Math.max(b1.y, b2.y)) - Math.max(Math.min(a1.y, a2.y), Math.min(b1.y, b2.y));
  }
  const horizontal = (p, q) => Math.abs(p.y - q.y) < 0.5;
  if (horizontal(a1, a2) && horizontal(b1, b2) && Math.abs(a1.y - b1.y) < 2) {
    return Math.min(Math.max(a1.x, a2.x), Math.max(b1.x, b2.x)) - Math.max(Math.min(a1.x, a2.x), Math.min(b1.x, b2.x));
  }
  return 0;
}

const stories = (await fs.readdir(GRAPHS)).filter((file) => file.endsWith('.json')).sort();

for (const file of stories) {
  const spec = JSON.parse(await fs.readFile(path.join(GRAPHS, file), 'utf8'));
  assert.deepEqual(validateGraphStory(spec, file), []);
  const states = resolveGraphStates(spec);
  const affinity = storyAffinity(states, edgeId);

  test(`${file}: every step lays out clean`, async () => {
    for (const [index, state] of states.entries()) {
      const where = `${file} step ${index + 1}`;
      const { cards, placement } = await layoutStep(state, affinity);
      const rects = new Map(state.nodes.map((n) => [n.id, rectOf(placement.nodes.get(n.id), cards.get(n.id))]));

      const ids = [...rects.keys()];
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          assert.ok(!overlaps(rects.get(ids[i]), rects.get(ids[j])), `${where}: cards ${ids[i]} and ${ids[j]} overlap`);
        }
      }

      const routes = state.edges.map((e) => ({ edge: e, id: edgeId(e), ...placement.edges.get(edgeId(e)) }));
      for (const route of routes) {
        assert.ok(route.points.length >= 2, `${where}: ${route.id} has no route`);
        for (let k = 1; k < route.points.length; k++) {
          const [a, b] = [route.points[k - 1], route.points[k]];
          assert.ok(Math.abs(a.x - b.x) < 0.5 || Math.abs(a.y - b.y) < 0.5, `${where}: ${route.id} has a diagonal segment`);
          for (const [id, rect] of rects) {
            if (id === route.edge.from || id === route.edge.to) continue;
            assert.ok(!segmentHitsRect(a, b, rect), `${where}: ${route.id} runs through card ${id}`);
          }
        }
      }

      for (let i = 0; i < routes.length; i++) {
        for (let j = i + 1; j < routes.length; j++) {
          const [p, q] = [routes[i].points, routes[j].points];
          for (let a = 1; a < p.length; a++) {
            for (let b = 1; b < q.length; b++) {
              const run = sharedRun(p[a - 1], p[a], q[b - 1], q[b]);
              assert.ok(run <= 1, `${where}: ${routes[i].id} and ${routes[j].id} share a ${run.toFixed(0)}-unit run`);
            }
          }
        }
      }

      const labelled = routes.filter((r) => r.label);
      for (const [i, route] of labelled.entries()) {
        const plate = boxRect(route.label);
        for (const [id, rect] of rects) assert.ok(!overlaps(plate, rect), `${where}: label of ${route.id} covers card ${id}`);
        for (const other of labelled.slice(i + 1)) assert.ok(!overlaps(plate, boxRect(other.label)), `${where}: labels of ${route.id} and ${other.id} collide`);
        for (const other of routes) {
          if (other === route) continue;
          for (let k = 1; k < other.points.length; k++) {
            assert.ok(!segmentHitsRect(other.points[k - 1], other.points[k], plate), `${where}: ${other.id} runs through the label of ${route.id}`);
          }
        }
      }
    }
  });

  test(`${file}: layout is deterministic`, async () => {
    const last = states[states.length - 1];
    const first = await layoutStep(last, affinity);
    const second = await layoutStep(last, storyAffinity(states, edgeId));
    const serialise = ({ placement }) => JSON.stringify([[...placement.nodes], [...placement.groups], [...placement.edges]]);
    assert.equal(serialise(first), serialise(second));
  });
}

test('backward edges between groups are laid out forwards and drawn the right way round', async () => {
  const state = {
    groups: [{ id: 'a' }, { id: 'b' }],
    nodes: [
      { id: 'a1', group: 'a' },
      { id: 'a2', group: 'a' },
      { id: 'b1', group: 'b' },
    ],
    edges: [
      { from: 'a1', to: 'b1' },
      { from: 'b1', to: 'a2' },
    ],
  };
  const { placement } = await layoutStep(state, storyAffinity([state], edgeId));
  const back = placement.edges.get('b1->a2').points;
  const b1 = placement.nodes.get('b1');
  const a2 = placement.nodes.get('a2');
  // Starts at b1 and ends at a2, whichever way ELK was asked to lay it out.
  assert.ok(Math.hypot(back[0].x - b1.x, back[0].y - b1.y) < Math.hypot(back[0].x - a2.x, back[0].y - a2.y));
  assert.ok(Math.hypot(back.at(-1).x - a2.x, back.at(-1).y - a2.y) < Math.hypot(back.at(-1).x - b1.x, back.at(-1).y - b1.y));
  // No loop around the outside: the route stays within the two groups' span.
  const ys = back.map((p) => p.y);
  const groups = [...placement.groups.values()];
  assert.ok(Math.min(...ys) >= Math.min(...groups.map((g) => g.y)) - 1);
  assert.ok(Math.max(...ys) <= Math.max(...groups.map((g) => g.y + g.height)) + 1);
});
