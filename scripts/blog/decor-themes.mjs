// Blog decor themes — minimal 24×24 glyphs, single stroke weight (matches Geist Pixel register aesthetic).

import { buildLucideSprite } from './lucide-sprites.mjs';

const stroke = "stroke='currentColor' stroke-width='1.5' stroke-linecap='square' stroke-linejoin='miter' fill='none'";

const defaultSprite = [
  "      symbol#pictogram-fan(viewBox='0 0 24 24')",
  `        g(${stroke})`,
  "          circle(cx='12' cy='12' r='2')",
  "          path(d='M12 10V4M12 14l5 4M12 14l-5 4')",
  "      symbol#pictogram-chip(viewBox='0 0 24 24')",
  `        g(${stroke})`,
  "          rect(x='7' y='7' width='10' height='10')",
  "          path(d='M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4')",
  "      symbol#pictogram-server(viewBox='0 0 24 24')",
  `        g(${stroke})`,
  "          rect(x='4' y='6' width='16' height='12')",
  "          line(x1='8' y1='10' x2='8' y2='10')",
  "          line(x1='8' y1='14' x2='8' y2='14')",
  "          line(x1='12' y1='10' x2='20' y2='10')",
  "          line(x1='12' y1='14' x2='20' y2='14')",
  "      symbol#pictogram-moon(viewBox='0 0 24 24')",
  `        g(${stroke})`,
  "          path(d='M20 12a8 8 0 1 1-8-8 6 6 0 0 0 8 8z')",
  "      symbol#pictogram-chat(viewBox='0 0 24 24')",
  `        g(${stroke})`,
  "          path(d='M4 9a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-3l-5 3v-3h-4a4 4 0 0 1-4-4z')",
  "          line(x1='9' y1='11' x2='9' y2='11')",
  "          line(x1='12' y1='11' x2='12' y2='11')",
  "          line(x1='15' y1='11' x2='15' y2='11')",
  "      symbol#pictogram-bolt(viewBox='0 0 24 24')",
  `        g(${stroke})`,
  "          path(d='M13 2L4 14h7l-2 8 9-12h-7l2-8z')",
  "      symbol#pictogram-disk(viewBox='0 0 24 24')",
  `        g(${stroke})`,
  "          ellipse(cx='12' cy='8' rx='8' ry='3')",
  "          path(d='M4 8v8a8 3 0 0 0 16 0v-8')",
  "      symbol#pictogram-therm(viewBox='0 0 24 24')",
  `        g(${stroke})`,
  "          path(d='M14 5a2 2 0 0 0-4 0v10.5a4 4 0 1 0 4 0V5z')",
  "          line(x1='12' y1='8' x2='12' y2='14')",
];

export const decorThemes = {
  default: {
    source: 'builtin',
    symbols: ['fan', 'chip', 'server', 'moon', 'chat', 'bolt', 'disk', 'therm'],
    sprite: defaultSprite,
  },
};

export function buildDecorSprite(theme) {
  if (theme.source === 'hybrid') {
    return [...theme.customSprite, ...buildLucideSprite(theme.lucideIcons)];
  }

  if (theme.source === 'lucide') {
    return buildLucideSprite(theme.lucideIcons ?? theme.icons);
  }

  return theme.sprite;
}

export function resolveDecorTheme(themeName) {
  if (typeof themeName === 'string' && decorThemes[themeName]) {
    return decorThemes[themeName];
  }

  return decorThemes.default;
}