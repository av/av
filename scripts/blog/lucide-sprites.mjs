import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lucideIconsDir = path.resolve(__dirname, '..', '..', 'node_modules', 'lucide-static', 'icons');

const elementPattern =
  /<(path|line|circle|rect|ellipse|polyline|polygon)([^>]*?)\/?>/g;
const attributePattern = /([a-zA-Z_:][\w:.-]*)="([^"]*)"/g;

function parseAttributes(attributeString) {
  const attributes = new Map();

  for (const match of attributeString.matchAll(attributePattern)) {
    attributes.set(match[1], match[2]);
  }

  return attributes;
}

function formatAttributes(attributes) {
  const ignored = new Set(['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin']);

  return [...attributes.entries()]
    .filter(([name]) => !ignored.has(name))
    .map(([name, value]) => {
      const kebabName = name.replace(/([A-Z])/g, '-$1').toLowerCase();
      return `${kebabName}='${value.replace(/'/g, "\\'")}'`;
    })
    .join(' ');
}

function convertElement(tagName, attributeString) {
  const attributes = parseAttributes(attributeString);
  const formatted = formatAttributes(attributes);

  return formatted.length > 0 ? `          ${tagName}(${formatted})` : `          ${tagName}()`;
}

export function lucideSvgToSpriteLines(iconName, svgContent) {
  const elements = [];

  for (const match of svgContent.matchAll(elementPattern)) {
    elements.push(convertElement(match[1], match[2]));
  }

  if (elements.length === 0) {
    throw new Error(`Lucide icon "${iconName}" did not contain drawable SVG elements.`);
  }

  return [
    `      symbol#pictogram-${iconName}(viewBox='0 0 24 24')`,
    "        g(fill='none' stroke='currentColor' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round')",
    ...elements,
  ];
}

export function buildLucideSprite(iconNames) {
  const uniqueIconNames = [...new Set(iconNames)];
  const lines = [];

  for (const iconName of uniqueIconNames) {
    const iconPath = path.join(lucideIconsDir, `${iconName}.svg`);

    if (!fs.existsSync(iconPath)) {
      throw new Error(`Missing Lucide icon file: ${iconPath}`);
    }

    const svgContent = fs.readFileSync(iconPath, 'utf8');
    lines.push(...lucideSvgToSpriteLines(iconName, svgContent));
  }

  return lines;
}