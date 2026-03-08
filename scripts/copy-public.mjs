import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'public');
const targetDir = path.join(projectRoot, 'dist');

async function main() {
  try {
    await fs.access(sourceDir);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return;
    }

    throw error;
  }

  await fs.mkdir(targetDir, { recursive: true });
  await fs.cp(sourceDir, targetDir, {
    recursive: true,
    force: true,
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
