import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'src');

// Native tile size — CSS displays at 384px (1.5×) via @mixin grain-tile in vars.scss.
const TILE_SIZE = 256;
// Keep values clustered around mid-gray so overlay/soft-light reads evenly
// on light and dark backgrounds (high contrast skews toward black specks).
const CONTRAST = 0.55;

function hashPixel(seed, x, y) {
  let h = (seed ^ Math.imul(x, 0x9e3779b1) ^ Math.imul(y, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x27d4eb2d) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x165667b1) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyContrast(value, contrast) {
  return clamp((value - 0.5) * contrast + 0.5, 0, 1);
}

function pixelRandom(seed, x, y) {
  return hashPixel(seed, x, y) / 0xffffffff;
}

function generateFilmGrain(size, seed) {
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const value = applyContrast(pixelRandom(seed, x, y), CONTRAST);
      const byte = Math.round(value * 255);
      const idx = (y * size + x) * 4;

      pixels[idx] = byte;
      pixels[idx + 1] = byte;
      pixels[idx + 2] = byte;
      pixels[idx + 3] = 255;
    }
  }

  return pixels;
}

function crc32(buffer) {
  let crc = 0xffffffff;

  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let j = 0; j < 8; j++) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function encodePng(rgba, width, height) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);

  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    Buffer.from(rgba.subarray(y * stride, (y + 1) * stride)).copy(raw, rowStart + 1);
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

async function readExistingPng(outputPath) {
  try {
    return await fs.readFile(outputPath);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

async function writeNoiseAsset(filename, seed) {
  const rgba = generateFilmGrain(TILE_SIZE, seed);
  const png = encodePng(rgba, TILE_SIZE, TILE_SIZE);
  const outputPath = path.join(outputDir, filename);
  const existing = await readExistingPng(outputPath);

  if (existing && existing.equals(png)) {
    return { outputPath, wrote: false };
  }

  await fs.writeFile(outputPath, png);
  return { outputPath, wrote: true };
}

async function main() {
  const { outputPath, wrote } = await writeNoiseAsset('noise-a.png', 0x61a7f21);
  const label = path.relative(projectRoot, outputPath);
  console.log(wrote ? `Wrote ${label}` : `Up to date ${label}`);

  if (wrote) {
    const cacheDir = path.join(projectRoot, '.parcel-cache');
    await fs.rm(cacheDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    console.log('Cleared .parcel-cache after noise asset update.');
    console.log('Restart the dev server if it is running (`npm run dev:clean`).');
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});