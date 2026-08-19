const getArgvValue = require('./getArgvValue');
const path = require('path');

const mode = getArgvValue('--mode') || 'development';

const version = require('../src/manifest').version;
const buildTime = new Date();

global.BUILD_ENV = {
  distName: `tms-${version}`,
  outputPath: path.join(__dirname, '../dist/'),
  mode: mode,
  // Always generate source maps for easier debugging
  devtool: 'source-map',
  version: version,
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
