import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeDecor, validateDecor } from './decor-config.mjs';

const file = 'content/blog/example.md';

test('normalizeDecor: pictogram shorthand string', () => {
  assert.deepEqual(normalizeDecor('my-seed'), {
    seed: 'my-seed',
    count: 16,
    theme: 'default',
    type: 'pictogram',
  });
});

test('normalizeDecor: explicit pictogram object', () => {
  assert.deepEqual(
    normalizeDecor({ seed: 's', type: 'pictogram', theme: 'default', count: 4 }),
    { seed: 's', count: 4, theme: 'default', type: 'pictogram' },
  );
});

test('normalizeDecor: explicit canvas object', () => {
  assert.deepEqual(
    normalizeDecor({ seed: 's', type: 'canvas', canvas: 'local-inference' }),
    { seed: 's', type: 'canvas', canvas: 'local-inference', color: null },
  );
});

test('normalizeDecor: infers canvas when canvas field is valid and type omitted', () => {
  assert.deepEqual(
    normalizeDecor({ seed: 's', canvas: 'local-inference' }),
    { seed: 's', type: 'canvas', canvas: 'local-inference', color: null },
  );
});

test('normalizeDecor: canvas with color', () => {
  assert.deepEqual(
    normalizeDecor({ seed: 's', canvas: 'local-inference', color: 'magenta' }),
    { seed: 's', type: 'canvas', canvas: 'local-inference', color: 'magenta' },
  );
});

test('normalizeDecor: unknown canvas kind returns null', () => {
  assert.equal(normalizeDecor({ seed: 's', canvas: 'unknown' }), null);
});

test('validateDecor: canvas without type passes validation', () => {
  assert.deepEqual(
    validateDecor({ decor: { seed: 's', canvas: 'local-inference' } }, file),
    [],
  );
});

test('validateDecor: canvas with explicit type passes validation', () => {
  assert.deepEqual(
    validateDecor({ decor: { seed: 's', type: 'canvas', canvas: 'local-inference' } }, file),
    [],
  );
});

test('validateDecor: unknown canvas kind fails validation', () => {
  const errors = validateDecor({ decor: { seed: 's', canvas: 'unknown' } }, file);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /decor\.canvas/);
});

test('validateDecor: canvas with type pictogram fails validation', () => {
  const errors = validateDecor(
    { decor: { seed: 's', type: 'pictogram', canvas: 'local-inference' } },
    file,
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /cannot be used with type: pictogram/);
});

test('validateDecor: type canvas without canvas field fails validation', () => {
  const errors = validateDecor({ decor: { seed: 's', type: 'canvas' } }, file);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /decor\.canvas/);
});

test('validateDecor: invalid canvas color fails validation', () => {
  const errors = validateDecor(
    { decor: { seed: 's', canvas: 'local-inference', color: 'neon' } },
    file,
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /decor\.color/);
});