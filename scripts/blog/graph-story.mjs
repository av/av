/**
 * Build-time support for animated graph stories embedded in blog posts.
 *
 * Authors drop `<div class="graph-story" data-graph="name"></div>` into a post
 * and keep the story data in `content/blog/graphs/name.json`. This module finds
 * the markers, validates the story (mirroring src/lib/graph/story.ts) and
 * inlines the JSON plus a no-JS fallback list into the post HTML.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const MARKER_PATTERN = /<div\s+class="graph-story"([^>]*)>\s*<\/div>/g;
const TRIGGERS = new Set(['scroll', 'click', 'timeline']);
const NODE_SHAPES = new Set(['circle', 'rect', 'diamond', 'hex', 'pill']);
const STATES = new Set(['default', 'active', 'muted', 'pending', 'error']);
const EDGE_STYLES = new Set(['solid', 'dashed', 'flow']);
const ACCENTS = new Set(['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta', 'tx', 'tx2', 'tx3']);

export function findGraphMarkers(html) {
  const markers = [];

  for (const match of html.matchAll(MARKER_PATTERN)) {
    const attrs = parseAttributes(match[1]);
    markers.push({
      raw: match[0],
      name: attrs['data-graph'] ?? null,
      trigger: attrs['data-trigger'] ?? null,
    });
  }

  return markers;
}

function parseAttributes(source) {
  const attrs = {};
  for (const match of source.matchAll(/([a-z-]+)="([^"]*)"/g)) {
    attrs[match[1]] = match[2];
  }
  return attrs;
}

export const edgeId = (edge) => edge.id ?? `${edge.from}->${edge.to}`;

/** Assigns patch fields onto target; `null` clears the field. */
function applyPatch(target, patch) {
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete target[key];
    else if (value !== undefined) target[key] = value;
  }
}

function isAccent(value) {
  return value === undefined || ACCENTS.has(value);
}

function checkNode(node, errors, where) {
  if (!node || typeof node.id !== 'string' || node.id.length === 0) {
    errors.push(`${where}: node needs a string "id".`);
    return;
  }
  if (node.shape !== undefined && !NODE_SHAPES.has(node.shape)) errors.push(`${where}: node "${node.id}" has unknown shape "${node.shape}".`);
  if (node.state !== undefined && !STATES.has(node.state)) errors.push(`${where}: node "${node.id}" has unknown state "${node.state}".`);
  if (!isAccent(node.color)) errors.push(`${where}: node "${node.id}" has unknown color "${node.color}".`);
  if (node.size !== undefined && !(Number.isFinite(node.size) && node.size > 0)) errors.push(`${where}: node "${node.id}" size must be a positive number.`);
}

function checkEdge(edge, errors, where) {
  if (!edge || typeof edge.from !== 'string' || typeof edge.to !== 'string') {
    errors.push(`${where}: edge needs string "from" and "to".`);
    return;
  }
  if (edge.style !== undefined && !EDGE_STYLES.has(edge.style)) errors.push(`${where}: edge "${edgeId(edge)}" has unknown style "${edge.style}".`);
  if (edge.state !== undefined && !STATES.has(edge.state)) errors.push(`${where}: edge "${edgeId(edge)}" has unknown state "${edge.state}".`);
  if (!isAccent(edge.color)) errors.push(`${where}: edge "${edgeId(edge)}" has unknown color "${edge.color}".`);
}

function checkGroup(group, errors, where) {
  if (!group || typeof group.id !== 'string' || group.id.length === 0) {
    errors.push(`${where}: group needs a string "id".`);
    return;
  }
  if (!isAccent(group.color)) errors.push(`${where}: group "${group.id}" has unknown color "${group.color}".`);
}

/** Applies one op to a state in place; returns an error string or null. */
function applyOp(state, op) {
  const node = (id) => state.nodes.find((n) => n.id === id);
  const group = (id) => state.groups.find((g) => g.id === id);
  const edge = (id) => state.edges.find((e) => edgeId(e) === id);

  if (!op || typeof op.op !== 'string') return 'op needs an "op" field';

  switch (op.op) {
    case 'add': {
      if (op.node) {
        if (node(op.node.id)) return `duplicate node "${op.node.id}"`;
        if (op.node.group !== undefined && !group(op.node.group)) return `node "${op.node.id}" references unknown group "${op.node.group}"`;
        state.nodes.push({ ...op.node });
      } else if (op.edge) {
        if (!node(op.edge.from) || !node(op.edge.to)) return `edge "${edgeId(op.edge)}" references an unknown node`;
        if (edge(edgeId(op.edge))) return `duplicate edge "${edgeId(op.edge)}"`;
        state.edges.push({ ...op.edge });
      } else if (op.group) {
        if (group(op.group.id)) return `duplicate group "${op.group.id}"`;
        if (op.group.parent !== undefined && !group(op.group.parent)) return `group "${op.group.id}" references unknown parent "${op.group.parent}"`;
        state.groups.push({ ...op.group });
      } else {
        return 'add needs one of node / edge / group';
      }
      return null;
    }
    case 'remove': {
      if (typeof op.node === 'string') {
        if (!node(op.node)) return `unknown node "${op.node}"`;
        state.nodes = state.nodes.filter((n) => n.id !== op.node);
        state.edges = state.edges.filter((e) => e.from !== op.node && e.to !== op.node);
      } else if (typeof op.edge === 'string') {
        if (!edge(op.edge)) return `unknown edge "${op.edge}"`;
        state.edges = state.edges.filter((e) => edgeId(e) !== op.edge);
      } else if (typeof op.group === 'string') {
        const removed = group(op.group);
        if (!removed) return `unknown group "${op.group}"`;
        for (const n of state.nodes) if (n.group === removed.id) n.group = removed.parent;
        for (const g of state.groups) if (g.parent === removed.id) g.parent = removed.parent;
        state.groups = state.groups.filter((g) => g.id !== removed.id);
      } else {
        return 'remove needs a node / edge / group id';
      }
      return null;
    }
    case 'set': {
      const { op: _op, node: nodeId, edge: edgeRef, group: groupId, ...patch } = op;
      if (typeof nodeId === 'string') {
        const target = node(nodeId);
        if (!target) return `unknown node "${nodeId}"`;
        if (patch.group != null && !group(patch.group)) return `node "${nodeId}" references unknown group "${patch.group}"`;
        applyPatch(target, patch);
      } else if (typeof edgeRef === 'string') {
        const target = edge(edgeRef);
        if (!target) return `unknown edge "${edgeRef}"`;
        applyPatch(target, patch);
      } else if (typeof groupId === 'string') {
        const target = group(groupId);
        if (!target) return `unknown group "${groupId}"`;
        if (patch.parent != null && !group(patch.parent)) return `group "${groupId}" references unknown parent "${patch.parent}"`;
        applyPatch(target, patch);
      } else {
        return 'set needs a node / edge / group id';
      }
      return null;
    }
    case 'move': {
      if (typeof op.node === 'string') {
        const target = node(op.node);
        if (!target) return `unknown node "${op.node}"`;
        if (op.group === null) delete target.group;
        else if (group(op.group)) target.group = op.group;
        else return `unknown group "${op.group}"`;
      } else if (typeof op.group === 'string') {
        const target = group(op.group);
        if (!target) return `unknown group "${op.group}"`;
        if (op.parent === null) delete target.parent;
        else if (op.parent === target.id) return `group "${target.id}" cannot be its own parent`;
        else if (group(op.parent)) target.parent = op.parent;
        else return `unknown parent group "${op.parent}"`;
      } else {
        return 'move needs a node or group id';
      }
      return null;
    }
    default:
      return `unknown op "${op.op}"`;
  }
}

function validateState(state, errors, where) {
  const nodeIds = new Set();
  const groupIds = new Set(state.groups.map((g) => g.id));

  for (const node of state.nodes) {
    checkNode(node, errors, where);
    if (nodeIds.has(node.id)) errors.push(`${where}: duplicate node "${node.id}".`);
    nodeIds.add(node.id);
    if (node.group !== undefined && !groupIds.has(node.group)) errors.push(`${where}: node "${node.id}" references unknown group "${node.group}".`);
  }

  for (const group of state.groups) {
    checkGroup(group, errors, where);
    const seen = new Set([group.id]);
    let parent = group.parent;
    while (parent !== undefined) {
      if (!groupIds.has(parent)) {
        errors.push(`${where}: group "${group.id}" references unknown parent "${parent}".`);
        break;
      }
      if (seen.has(parent)) {
        errors.push(`${where}: group "${group.id}" has a cyclic parent chain.`);
        break;
      }
      seen.add(parent);
      parent = state.groups.find((g) => g.id === parent)?.parent;
    }
  }

  const edgeIds = new Set();
  for (const edge of state.edges) {
    checkEdge(edge, errors, where);
    const id = edgeId(edge);
    if (edgeIds.has(id)) errors.push(`${where}: duplicate edge "${id}".`);
    edgeIds.add(id);
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) errors.push(`${where}: edge "${id}" references an unknown node.`);
  }
}

/**
 * Resolves every step and returns validation errors (empty when valid).
 * Mirrors resolveStory() in src/lib/graph/story.ts.
 */
export function validateGraphStory(spec, label = 'graph story') {
  const errors = [];

  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return [`${label}: must be an object with a "steps" array.`];
  }
  if (!Array.isArray(spec.steps) || spec.steps.length === 0) {
    return [`${label}: "steps" must be a non-empty array.`];
  }
  if (spec.trigger !== undefined && !TRIGGERS.has(spec.trigger)) {
    errors.push(`${label}: "trigger" must be one of: ${[...TRIGGERS].join(', ')}.`);
  }
  if (spec.interval !== undefined && !(Number.isFinite(spec.interval) && spec.interval > 0)) {
    errors.push(`${label}: "interval" must be a positive number of milliseconds.`);
  }
  if (spec.aspect !== undefined && !(Number.isFinite(spec.aspect) && spec.aspect > 0)) {
    errors.push(`${label}: "aspect" must be a positive number.`);
  }

  let previous = { nodes: [], edges: [], groups: [] };

  spec.steps.forEach((step, index) => {
    const where = `${label} step ${index}`;
    if (!step || typeof step !== 'object') {
      errors.push(`${where}: must be an object.`);
      return;
    }
    if (step.title !== undefined && typeof step.title !== 'string') errors.push(`${where}: "title" must be a string.`);
    if (step.caption !== undefined && typeof step.caption !== 'string') errors.push(`${where}: "caption" must be a string.`);
    if (step.body !== undefined && typeof step.body !== 'string') errors.push(`${where}: "body" must be a string.`);
    if (step.focus !== undefined && step.focus !== 'all' && !(Array.isArray(step.focus) && step.focus.every((id) => typeof id === 'string'))) {
      errors.push(`${where}: "focus" must be "all" or an array of ids.`);
    }

    const base = step.state ?? previous;
    if (!base || !Array.isArray(base.nodes) || !Array.isArray(base.edges) || !Array.isArray(base.groups)) {
      errors.push(`${where}: "state" needs nodes, edges and groups arrays.`);
      return;
    }

    const state = {
      nodes: base.nodes.map((n) => ({ ...n })),
      edges: base.edges.map((e) => ({ ...e })),
      groups: base.groups.map((g) => ({ ...g })),
    };

    if (step.ops !== undefined && !Array.isArray(step.ops)) {
      errors.push(`${where}: "ops" must be an array.`);
    } else {
      (step.ops ?? []).forEach((op, opIndex) => {
        const error = applyOp(state, op);
        if (error) errors.push(`${where} op ${opIndex}: ${error}.`);
      });
    }

    validateState(state, errors, where);
    if (Array.isArray(step.focus)) {
      const known = new Set([...state.nodes.map((n) => n.id), ...state.groups.map((g) => g.id)]);
      for (const id of step.focus) if (!known.has(id)) errors.push(`${where}: focus references unknown id "${id}".`);
    }
    previous = state;
  });

  return errors;
}

/**
 * Every step's full state, in order. Assumes a story that already passed
 * validateGraphStory(); throws on the first op that does not apply.
 */
export function resolveGraphStates(spec) {
  const states = [];
  let previous = { nodes: [], edges: [], groups: [] };
  for (const step of spec.steps) {
    const base = step.state ?? previous;
    const state = {
      nodes: base.nodes.map((n) => ({ ...n })),
      edges: base.edges.map((e) => ({ ...e })),
      groups: base.groups.map((g) => ({ ...g })),
    };
    for (const op of step.ops ?? []) {
      const error = applyOp(state, op);
      if (error) throw new Error(error);
    }
    states.push(state);
    previous = state;
  }
  return states;
}

export async function loadGraphStory(graphsDir, name) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error(`graph story name "${name}" must be a lowercase slug.`);
  }
  const filePath = path.join(graphsDir, `${name}.json`);
  const source = await fs.readFile(filePath, 'utf8');
  return JSON.parse(source);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Renders the hydrated marker: fallback list + inline JSON the runtime reads. */
export function renderGraphStoryMarkup(spec, { name, trigger }) {
  const resolvedTrigger = trigger ?? spec.trigger ?? 'click';
  const json = JSON.stringify(spec).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
  const items = spec.steps
    .map((step) => {
      const title = step.title ? `<strong>${escapeHtml(step.title)}</strong>` : '';
      const caption = step.caption ? ` ${step.caption}` : '';
      const body = step.body ? `<p>${step.body}</p>` : '';
      return `<li>${title}${caption}${body}</li>`;
    })
    .join('');

  return [
    `<div class="graph-story" data-graph="${escapeHtml(name)}" data-trigger="${escapeHtml(resolvedTrigger)}">`,
    `<ol class="graph-story__fallback">${items}</ol>`,
    `<script type="application/json" data-graph-story>${json}</script>`,
    '</div>',
  ].join('');
}

/**
 * Replaces every graph marker in `html`. Returns the new HTML, whether any
 * story was embedded, and validation errors keyed to `relativeFilePath`.
 */
export async function injectGraphStories(html, { graphsDir, relativeFilePath }) {
  const markers = findGraphMarkers(html);
  const errors = [];
  let output = html;

  for (const marker of markers) {
    if (!marker.name) {
      errors.push(`${relativeFilePath}: graph-story marker needs a data-graph="name" attribute.`);
      continue;
    }
    if (marker.trigger !== null && !TRIGGERS.has(marker.trigger)) {
      errors.push(`${relativeFilePath}: graph-story "${marker.name}" has unknown data-trigger "${marker.trigger}".`);
      continue;
    }

    let spec;
    try {
      spec = await loadGraphStory(graphsDir, marker.name);
    } catch (error) {
      errors.push(`${relativeFilePath}: cannot load graph story "${marker.name}": ${error.message}`);
      continue;
    }

    const storyErrors = validateGraphStory(spec, `graphs/${marker.name}.json`);
    if (storyErrors.length > 0) {
      errors.push(...storyErrors.map((message) => `${relativeFilePath}: ${message}`));
      continue;
    }

    output = output.replace(marker.raw, renderGraphStoryMarkup(spec, { name: marker.name, trigger: marker.trigger }));
  }

  return { html: output, hasGraphStory: markers.length > 0 && errors.length === 0, errors };
}
