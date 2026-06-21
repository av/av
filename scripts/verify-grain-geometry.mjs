#!/usr/bin/env node
/**
 * Manual geometry gate for splitter grain alignment.
 *
 * Usage: npm run build (runs verify:grain automatically)
 *
 * Bootstraps Playwright into scripts/.verify-deps on first run (~100 MB Chromium).
 */
import { createServer } from 'node:http';
import { readFile, access } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, '..');
const DIST = join(ROOT, 'dist');
const DEPS = join(SCRIPT_DIR, '.verify-deps');
const PAGES = ['/index.html', '/harbor-qr.html'];
const VIEWPORTS = [
  { name: 'desktop', width: 1200, height: 800 },
  { name: 'mobile', width: 390, height: 844 }
];
const EPSILON = 0.01;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2'
};

async function ensurePlaywright() {
  const entry = join(DEPS, 'node_modules', 'playwright', 'index.mjs');

  try {
    await access(entry);
  } catch {
    console.log('verify:grain: installing playwright@1.49.0 into scripts/.verify-deps …');
    const install = spawnSync(
      'npm',
      ['install', '--prefix', DEPS, 'playwright@1.49.0'],
      { stdio: 'inherit' }
    );

    if (install.status !== 0) {
      throw new Error('failed to install playwright');
    }

    const browsers = spawnSync(
      join(DEPS, 'node_modules', '.bin', 'playwright'),
      ['install', 'chromium'],
      { stdio: 'inherit' }
    );

    if (browsers.status !== 0) {
      throw new Error('failed to install chromium for playwright');
    }
  }

  return import(pathToFileURL(entry).href);
}

function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const url = req.url?.split('?')[0] || '/';
      const file = join(DIST, url === '/' ? 'index.html' : url);

      try {
        const data = await readFile(file);
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });

    server.listen(0, () => {
      const { port } = server.address();
      resolve({ server, port });
    });
  });
}

async function verifyPage(page, pagePath) {
  await page.goto(pagePath, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const result = await page.evaluate((epsilon) => {
    const grain = document.querySelector('.grain-layer');
    const splitters = [...document.querySelectorAll('section.splitter')];

    if (!grain) {
      return { ok: false, errors: ['missing .grain-layer'] };
    }

    if (splitters.length === 0) {
      return { ok: true, errors: [] };
    }

    const grainRect = grain.getBoundingClientRect();
    const clipPath = grain.style.clipPath;
    const errors = [];

    splitters.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const exactTop = Math.round((rect.top - grainRect.top) * 100) / 100;
      const exactBottom = Math.round((rect.bottom - grainRect.top) * 100) / 100;
      const grainBgY = parseFloat(getComputedStyle(el).getPropertyValue('--grain-bg-y')) || 0;
      const expectedPhase = -(((exactTop % 384) + 384) % 384);
      const holes = clipPath.match(/M 0 [\d.]+ H [\d.]+ V [\d.]+ H 0 Z/g) || [];
      const hole = holes[i + 1];
      const match = hole?.match(/M 0 ([\d.]+) H [\d.]+ V ([\d.]+) H 0 Z/);

      if (!match) {
        errors.push(`splitter ${i}: missing clip hole`);
        return;
      }

      const clipTop = Number(match[1]);
      const clipBottom = Number(match[2]);

      if (Math.abs(clipTop - exactTop) > epsilon) {
        errors.push(`splitter ${i}: clip top ${clipTop} != band ${exactTop}`);
      }

      if (Math.abs(clipBottom - exactBottom) > epsilon) {
        errors.push(`splitter ${i}: clip bottom ${clipBottom} != band ${exactBottom}`);
      }

      if (Math.abs(grainBgY - expectedPhase) > epsilon) {
        errors.push(`splitter ${i}: --grain-bg-y ${grainBgY} != phase ${expectedPhase}`);
      }
    });

    return { ok: errors.length === 0, errors };
  }, EPSILON);

  if (!result.ok) {
    throw new Error(`${pagePath}:\n  - ${result.errors.join('\n  - ')}`);
  }
}

async function main() {
  const { chromium } = await ensurePlaywright();
  const { server, port } = await startServer();
  const browser = await chromium.launch();

  try {
    for (const viewport of VIEWPORTS) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height }
      });

      for (const pagePath of PAGES) {
        await verifyPage(page, `http://127.0.0.1:${port}${pagePath}`);
        console.log(`ok: ${viewport.name} ${pagePath}`);
      }

      await page.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('verify:grain failed');
  console.error(err.message || err);
  process.exit(1);
});