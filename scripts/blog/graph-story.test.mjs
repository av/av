import assert from 'node:assert/strict';
import test from 'node:test';

import { findGraphMarkers, injectGraphStories, renderGraphStoryMarkup, validateGraphStory } from './graph-story.mjs';

const baseStory = () => ({
  steps: [
    {
      title: 'One',
      state: {
        nodes: [{ id: 'a', kind: 'machine' }, { id: 'b', group: 'g' }],
        edges: [{ from: 'a', to: 'b' }],
        groups: [{ id: 'g', label: 'Group' }],
      },
    },
    {
      title: 'Two',
      ops: [
        { op: 'add', node: { id: 'c' } },
        { op: 'add', edge: { from: 'b', to: 'c', style: 'flow' } },
        { op: 'set', node: 'a', label: 'Renamed', state: 'active' },
        { op: 'move', node: 'a', group: 'g' },
        { op: 'add', group: { id: 'inner', parent: 'g' } },
        { op: 'move', node: 'c', group: 'inner' },
      ],
    },
    {
      ops: [{ op: 'remove', group: 'inner' }, { op: 'remove', node: 'b' }],
    },
  ],
});

test('valid story resolves without errors', () => {
  assert.deepEqual(validateGraphStory(baseStory()), []);
});

test('ops are applied on top of the previous step', () => {
  const story = baseStory();
  story.steps.push({ ops: [{ op: 'set', node: 'c', label: 'still here after inner group removal' }] });
  assert.deepEqual(validateGraphStory(story), []);
});

test('null in a set op clears the field', () => {
  const story = baseStory();
  story.steps[0].state.groups[0].x = 40;
  story.steps[0].state.groups[0].y = 40;
  story.steps[1].ops.push({ op: 'set', group: 'g', x: null, y: null, label: null });
  assert.deepEqual(validateGraphStory(story), []);
});

test('dangling references are reported with the step index', () => {
  const story = baseStory();
  story.steps[1].ops.push({ op: 'add', edge: { from: 'a', to: 'nope' } });
  story.steps[2].ops.push({ op: 'set', node: 'b', label: 'removed earlier in the same step' });

  const errors = validateGraphStory(story, 'story');
  assert.equal(errors.length, 2);
  assert.match(errors[0], /story step 1 op 6: edge "a->nope" references an unknown node/);
  assert.match(errors[1], /story step 2 op 2: unknown node "b"/);
});

test('removing a node drops its edges', () => {
  const story = baseStory();
  story.steps[2].ops.push({ op: 'set', edge: 'a->b', label: 'gone' });
  assert.match(validateGraphStory(story)[0], /unknown edge "a->b"/);
});

test('unknown enum values are rejected', () => {
  const story = baseStory();
  story.steps[0].state.nodes[0].shape = 'blob';
  story.steps[0].state.edges[0].style = 'wavy';
  story.trigger = 'hover';

  const errors = validateGraphStory(story);
  assert.match(errors[0], /"trigger" must be one of/);
  assert.ok(errors.some((e) => /unknown shape "blob"/.test(e)));
  assert.ok(errors.some((e) => /unknown style "wavy"/.test(e)));
});

test('cyclic group parents are rejected', () => {
  const story = {
    steps: [{ state: { nodes: [], edges: [], groups: [{ id: 'x', parent: 'y' }, { id: 'y', parent: 'x' }] } }],
  };
  assert.match(validateGraphStory(story)[0], /cyclic parent chain/);
});

test('edges may end on a group, and removing the group drops them', () => {
  const story = {
    steps: [
      {
        state: {
          nodes: [{ id: 'phone-app' }, { id: 'inside', group: 'machine' }],
          edges: [{ from: 'phone-app', to: 'machine' }],
          groups: [{ id: 'machine' }],
        },
      },
      { ops: [{ op: 'remove', group: 'machine' }, { op: 'add', edge: { from: 'phone-app', to: 'inside' } }] },
    ],
  };
  assert.deepEqual(validateGraphStory(story), []);
});

test('an edge from a group to its own member is rejected', () => {
  const story = {
    steps: [{ state: { nodes: [{ id: 'inside', group: 'outer' }], edges: [{ from: 'inside', to: 'outer' }], groups: [{ id: 'outer' }] } }],
  };
  assert.match(validateGraphStory(story)[0], /joins a group to something inside it/);
});

test('markers are found and hydrated with fallback + json', async () => {
  const html = '<p>Intro</p>\n<div class="graph-story" data-graph="demo" data-trigger="click"></div>\n<p>Outro</p>';
  assert.deepEqual(findGraphMarkers(html), [
    { raw: '<div class="graph-story" data-graph="demo" data-trigger="click"></div>', name: 'demo', trigger: 'click' },
  ]);

  const markup = renderGraphStoryMarkup(baseStory(), { name: 'demo', trigger: null });
  assert.match(markup, /data-trigger="click"/);
  assert.match(markup, /<ol class="graph-story__fallback"><li><strong>One<\/strong><\/li>/);
  assert.match(markup, /<script type="application\/json" data-graph-story>\{"steps"/);
  assert.doesNotMatch(markup, /<\/script>.*<\/script>/s);
});

test('missing story file is reported instead of thrown', async () => {
  const result = await injectGraphStories('<div class="graph-story" data-graph="missing"></div>', {
    graphsDir: '/nonexistent',
    relativeFilePath: 'content/blog/x.md',
  });
  assert.equal(result.hasGraphStory, false);
  assert.match(result.errors[0], /cannot load graph story "missing"/);
});
