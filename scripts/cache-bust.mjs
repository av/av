import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cacheDir = path.resolve(__dirname, '..', '.parcel-cache');

async function bustParcelCache() {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await fs.rm(cacheDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
      return;
    } catch (error) {
      if (attempt === 4) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
}

bustParcelCache().catch((error) => {
  console.error(
    'Failed to clear .parcel-cache. Stop any running dev server, then retry `npm run cache:bust`.',
  );
  console.error(error.message);
  process.exitCode = 1;
});