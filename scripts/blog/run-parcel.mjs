import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const manifestPath = path.join(projectRoot, 'src', 'blog', '.generated-manifest.json');

const supportedModes = new Set(['serve', 'build']);

async function main() {
  const mode = process.argv[2];

  if (!supportedModes.has(mode)) {
    throw new Error('Usage: node scripts/blog/run-parcel.mjs <serve|build>');
  }

  const manifest = await readManifest();
  const entrypoints = buildEntrypoints(manifest.generatedSlugs);

  await runParcel(mode, entrypoints);
}

async function readManifest() {
  let rawManifest;

  try {
    rawManifest = await fs.readFile(manifestPath, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      throw new Error('Missing src/blog/.generated-manifest.json. Run `npm run blog:generate` first.');
    }

    throw error;
  }

  let parsed;

  try {
    parsed = JSON.parse(rawManifest);
  } catch (error) {
    throw new Error(`Invalid manifest JSON at src/blog/.generated-manifest.json: ${error.message}`);
  }

  if (!parsed || !Array.isArray(parsed.generatedSlugs)) {
    throw new Error('Manifest must include a "generatedSlugs" array.');
  }

  return {
    generatedSlugs: parsed.generatedSlugs.filter((slug) => typeof slug === 'string' && slug.length > 0),
  };
}

function buildEntrypoints(slugs) {
  const staticEntrypoints = [
    path.join(projectRoot, 'src', 'index.pug'),
    path.join(projectRoot, 'src', 'harbor-qr.pug'),
    path.join(projectRoot, 'src', 'blog', 'index.pug'),
  ];

  const slugEntrypoints = slugs.map((slug) => path.join(projectRoot, 'src', 'blog', slug, 'index.pug'));

  return [...new Set([...staticEntrypoints, ...slugEntrypoints])];
}

function runParcel(mode, entrypoints) {
  const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const args = ['parcel', mode, ...entrypoints];

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Parcel ${mode} failed with exit code ${code}.`));
    });
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
