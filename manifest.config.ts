import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const manifestPath = new URL('./src/manifest.json', import.meta.url);

const manifest = JSON.parse(readFileSync(fileURLToPath(manifestPath), 'utf8'));

export default manifest;
