#!/usr/bin/env node
/**
 * Records a graph story from the built site playing through all its steps.
 *
 * Usage: node scripts/record-graph-story.mjs [/blog/agentic-setup/index.html] [docs/graph-story-demo] [story index on page]
 *
 * Requires `npm run build` first (dist/ and the Playwright install that
 * verify:grain bootstraps into scripts/.verify-deps). Needs ffmpeg on PATH.
 * Writes <out>.webm, <out>.mp4 and <out>.png (poster).
 */
import { createServer } from 'node:http';
import { readFile, access, rm, mkdir, rename } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(SCRIPT_DIR, '..');
const DIST = join(ROOT, 'dist');
const DEPS = join(SCRIPT_DIR, '.verify-deps');

const PAGE = process.argv[2] ?? '/blog/agentic-setup/index.html';
const STORY_INDEX = Number(process.argv[4] ?? 0);
const OUT = join(ROOT, process.argv[3] ?? 'docs/graph-story-demo');
const VIEWPORT = { width: 960, height: 800 };
const STEP_HOLD_MS = 2400;
/** Poster frame is taken this far into the story. */
const POSTER_AT = 0.7;

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

async function loadPlaywright() {
  const entry = join(DEPS, 'node_modules', 'playwright', 'index.mjs');
  await access(entry).catch(() => {
    throw new Error('Playwright missing; run `npm run build` (verify:grain installs it) first.');
  });
  return import(pathToFileURL(entry).href);
}

function serve() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const url = req.url?.split('?')[0] || '/';
      const file = join(DIST, url.endsWith('/') ? `${url}index.html` : url);
      try {
        const data = await readFile(file);
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

function pickH264Encoder() {
  const probe = spawnSync('ffmpeg', ['-hide_banner', '-encoders'], { encoding: 'utf8' });
  const available = probe.stdout ?? '';
  if (/\blibx264\b/.test(available)) return ['-c:v', 'libx264', '-crf', '28'];
  if (/\blibopenh264\b/.test(available)) return ['-c:v', 'libopenh264', '-b:v', '900k'];
  throw new Error('no H.264 encoder in ffmpeg (need libx264 or libopenh264)');
}

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`ffmpeg failed: ${args.join(' ')}`);
}

async function main() {
  const { chromium } = await loadPlaywright();
  const { server, port } = await serve();
  const videoDir = join(tmpdir(), `graph-story-${Date.now()}`);
  await mkdir(videoDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    colorScheme: 'dark',
    deviceScaleFactor: 1,
    recordVideo: { dir: videoDir, size: VIEWPORT },
  });
  const page = await context.newPage();

  await page.goto(`http://127.0.0.1:${port}${PAGE}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.graph-story.is-ready');
  const story = page.locator('.graph-story.is-ready').nth(STORY_INDEX);
  const figure = story.locator('.graph-story__figure');

  // Pin the figure just below the top edge so the crop is stable.
  await figure.evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 12));
  await page.waitForTimeout(600);
  const box = await figure.boundingBox();
  if (!box) throw new Error('graph story figure not found');

  const steps = await story.locator('.graph-story__dot').count();
  const isScroll = (await story.getAttribute('class'))?.includes('is-trigger-scroll') ?? false;
  const next = story.locator('.graph-story__button--next');

  // Scroll-driven stories are advanced by scrolling, not by clicking: that is
  // how a reader sees them, and clicking would fight Playwright's own
  // scroll-into-view before each click.
  const advance = async (index) => {
    if (!isScroll) {
      await next.click();
      return;
    }
    await page.evaluate(
      ([storyIndex, panelIndex]) => {
        const target = document.querySelectorAll('.graph-story.is-ready')[storyIndex];
        const panel = target.querySelectorAll('.graph-story__panel')[panelIndex];
        window.scrollTo({ top: window.scrollY + panel.getBoundingClientRect().top - window.innerHeight * 0.25, behavior: 'smooth' });
      },
      [STORY_INDEX, index],
    );
  };

  // Only scroll stories need an opening move; click stories already show step 1.
  if (isScroll) await advance(0);
  await page.waitForTimeout(STEP_HOLD_MS);

  const posterStep = Math.max(1, Math.round((steps - 1) * POSTER_AT));

  for (let i = 1; i < steps; i++) {
    await advance(i);
    if (i === posterStep) {
      await page.waitForTimeout(1200);
      await figure.screenshot({ path: `${OUT}.png` });
      await page.waitForTimeout(STEP_HOLD_MS - 1200);
    } else {
      await page.waitForTimeout(STEP_HOLD_MS);
    }
  }
  await page.waitForTimeout(800);

  const video = page.video();
  await context.close();
  await browser.close();
  server.close();

  const rawPath = await video.path();
  const crop = `crop=${Math.round(box.width)}:${Math.round(box.height)}:${Math.round(box.x)}:${Math.round(box.y)}`;
  const even = 'scale=trunc(iw/2)*2:trunc(ih/2)*2';

  ffmpeg(['-i', rawPath, '-vf', `${crop},${even}`, ...pickH264Encoder(), '-pix_fmt', 'yuv420p', '-an', `${OUT}.mp4`]);
  ffmpeg(['-i', rawPath, '-vf', `${crop},${even}`, '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-an', `${OUT}.webm`]);
  await rm(videoDir, { recursive: true, force: true });

  console.log(`recorded ${steps} steps → ${OUT}.{mp4,webm,png}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
