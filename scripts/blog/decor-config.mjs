import { decorCanvasTypes } from './decor-canvas-kinds.mjs';
import { decorThemes } from './decor-themes.mjs';

export { decorCanvasTypes };

const canvasColors = new Set([
  'tx', 'tx2', 'tx3',
  'red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple', 'magenta',
]);

function hasValidCanvasField(value) {
  return typeof value.canvas === 'string' && decorCanvasTypes.has(value.canvas.trim());
}

function resolveDecorType(value) {
  if (value.type === 'canvas') {
    return 'canvas';
  }

  if (value.type === 'pictogram') {
    return 'pictogram';
  }

  if (hasValidCanvasField(value)) {
    return 'canvas';
  }

  return 'pictogram';
}

export function validateDecor(frontmatter, relativeFilePath) {
  if (!Object.hasOwn(frontmatter, 'decor')) {
    return [];
  }

  const value = frontmatter.decor;

  if (typeof value === 'string') {
    return value.trim().length > 0
      ? []
      : [`${relativeFilePath}: "decor" seed must be a non-empty string.`];
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const errors = [];

    if (typeof value.seed !== 'string' || value.seed.trim().length === 0) {
      errors.push(`${relativeFilePath}: "decor.seed" must be a non-empty string.`);
    }

    if (
      Object.hasOwn(value, 'count') &&
      (!Number.isFinite(value.count) || value.count <= 0 || value.count > 64)
    ) {
      errors.push(`${relativeFilePath}: "decor.count" must be a number between 1 and 64.`);
    }

    if (
      Object.hasOwn(value, 'theme') &&
      (typeof value.theme !== 'string' || !Object.hasOwn(decorThemes, value.theme.trim()))
    ) {
      errors.push(
        `${relativeFilePath}: "decor.theme" must be one of: ${Object.keys(decorThemes).join(', ')}.`,
      );
    }

    if (Object.hasOwn(value, 'type')) {
      if (value.type !== 'canvas' && value.type !== 'pictogram') {
        errors.push(`${relativeFilePath}: "decor.type" must be "canvas" or "pictogram".`);
      }
    }

    if (Object.hasOwn(value, 'canvas')) {
      if (!hasValidCanvasField(value)) {
        errors.push(
          `${relativeFilePath}: "decor.canvas" must be one of: ${[...decorCanvasTypes].join(', ')}.`,
        );
      }

      if (value.type === 'pictogram') {
        errors.push(
          `${relativeFilePath}: "decor.canvas" cannot be used with type: pictogram; use type: canvas or omit type.`,
        );
      }
    }

    if (
      Object.hasOwn(value, 'color') &&
      (typeof value.color !== 'string' || !canvasColors.has(value.color.trim()))
    ) {
      errors.push(
        `${relativeFilePath}: "decor.color" must be one of: ${[...canvasColors].join(', ')}.`,
      );
    }

    const decorType = resolveDecorType(value);

    if (decorType === 'canvas' && !hasValidCanvasField(value)) {
      errors.push(
        `${relativeFilePath}: "decor.canvas" must be one of: ${[...decorCanvasTypes].join(', ')}.`,
      );
    }

    return errors;
  }

  return [
    `${relativeFilePath}: "decor" must be a string or an object with { seed, count?, theme?, type?, canvas? }.`,
  ];
}

export function normalizeDecor(value) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0
      ? { seed: value.trim(), count: 16, theme: 'default', type: 'pictogram' }
      : null;
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const seed = typeof value.seed === 'string' ? value.seed.trim() : null;

    if (!seed || seed.length === 0) {
      return null;
    }

    if (Object.hasOwn(value, 'canvas') && !hasValidCanvasField(value)) {
      return null;
    }

    const type = resolveDecorType(value);

    if (type === 'canvas') {
      const canvas =
        typeof value.canvas === 'string' && decorCanvasTypes.has(value.canvas.trim())
          ? value.canvas.trim()
          : null;

      const color =
        typeof value.color === 'string' && canvasColors.has(value.color.trim())
          ? value.color.trim()
          : null;

      return canvas ? { seed, type: 'canvas', canvas, color } : null;
    }

    const count =
      typeof value.count === 'number' && Number.isFinite(value.count) && value.count > 0
        ? Math.min(Math.round(value.count), 64)
        : 16;
    const theme =
      typeof value.theme === 'string' && Object.hasOwn(decorThemes, value.theme.trim())
        ? value.theme.trim()
        : 'default';

    return { seed, count, theme, type: 'pictogram' };
  }

  return null;
}