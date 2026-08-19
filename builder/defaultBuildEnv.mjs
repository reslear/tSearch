import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getArgvValue } from './getArgvValue.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mode = getArgvValue('--mode') || 'development';
const versionPath = path.resolve(__dirname, '../src/manifest.json');
const manifest = JSON.parse(await readFile(versionPath, 'utf8'));
const version = manifest.version;
const buildTime = new Date();

export const BUILD_ENV = {
  distName: `tms-${version}`,
  outputPath: path.join(__dirname, '../dist/'),
  mode,
  // Always generate source maps for easier debugging
  devtool: 'source-map',
  version,
  buildTime: buildTime.toISOString(),
  babelEnvOptions: {
    targets: {
      chrome: mode === 'development' ? '71' : '49',
    },
    useBuiltIns: mode === 'development' ? false : 'usage',
  },
  FLAG_ENABLE_LOGGER: true,
};

console.log(`[build] version=${version}; time=${buildTime.toISOString()}`);
